import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue" | "cancelled";

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
}

export interface Invoice {
  id: string;
  company_id: string;
  customer_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  created_at: string;
}

export interface InvoiceWithCustomer extends Invoice {
  customer_name: string;
}

export function useInvoices() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["invoices", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_invoices")
        .select("*, customers!inner(name)")
        .eq("company_id", companyId!)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: { customers: { name: string } } & Invoice) => ({
        ...row,
        customer_name: row.customers?.name ?? "Unknown",
      })) as InvoiceWithCustomer[];
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoice", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: invoice, error } = await supabase
        .from("customer_invoices")
        .select("*, customers(id, name, email)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!invoice) return null;

      const { data: lines } = await supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", id!)
        .order("position");

      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", id!)
        .order("paid_at", { ascending: false });

      return { invoice, lines: lines ?? [], payments: payments ?? [] };
    },
  });
}

export function useInvoicesForCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customer-invoices", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_invoices")
        .select("*")
        .eq("customer_id", customerId!)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

export interface CreateInvoiceInput {
  customer_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  notes: string | null;
  lines: { description: string; quantity: number; unit_price: number; tax_rate: number }[];
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const subtotal = input.lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
      const tax_total = input.lines.reduce(
        (s, l) => s + (l.quantity * l.unit_price * l.tax_rate) / 100,
        0,
      );
      const total = subtotal + tax_total;

      const { data: invoice, error } = await supabase
        .from("customer_invoices")
        .insert({
          company_id: companyId!,
          customer_id: input.customer_id,
          invoice_number: input.invoice_number,
          issue_date: input.issue_date,
          due_date: input.due_date,
          status: input.status,
          notes: input.notes,
          subtotal,
          tax_total,
          total,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      const linesPayload = input.lines.map((l, i) => ({
        invoice_id: invoice.id,
        position: i,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        line_total: l.quantity * l.unit_price * (1 + l.tax_rate / 100),
      }));
      if (linesPayload.length > 0) {
        const { error: lineErr } = await supabase.from("invoice_lines").insert(linesPayload);
        if (lineErr) throw lineErr;
      }

      return invoice.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
