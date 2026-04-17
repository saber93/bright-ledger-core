import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type BillStatus = "draft" | "received" | "partial" | "paid" | "overdue" | "cancelled";

export interface Bill {
  id: string;
  company_id: string;
  supplier_id: string;
  bill_number: string;
  issue_date: string;
  due_date: string | null;
  status: BillStatus;
  currency: string;
  subtotal: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  created_at: string;
}

export interface BillWithSupplier extends Bill {
  supplier_name: string;
}

export function useBills() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["bills", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_bills")
        .select("*, suppliers!inner(name)")
        .eq("company_id", companyId!)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: { suppliers: { name: string } } & Bill) => ({
        ...row,
        supplier_name: row.suppliers?.name ?? "Unknown",
      })) as BillWithSupplier[];
    },
  });
}

export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: ["bill", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: bill, error } = await supabase
        .from("supplier_bills")
        .select("*, suppliers(id, name, email)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!bill) return null;

      const { data: lines } = await supabase
        .from("bill_lines")
        .select("*")
        .eq("bill_id", id!)
        .order("position");

      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("bill_id", id!)
        .order("paid_at", { ascending: false });

      return { bill, lines: lines ?? [], payments: payments ?? [] };
    },
  });
}

export function useBillsForSupplier(supplierId: string | undefined) {
  return useQuery({
    queryKey: ["supplier-bills", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_bills")
        .select("*")
        .eq("supplier_id", supplierId!)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data as Bill[];
    },
  });
}

export interface CreateBillInput {
  supplier_id: string;
  bill_number: string;
  issue_date: string;
  due_date: string | null;
  status: BillStatus;
  notes: string | null;
  lines: { description: string; quantity: number; unit_price: number; tax_rate: number }[];
}

export function useCreateBill() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateBillInput) => {
      const subtotal = input.lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
      const tax_total = input.lines.reduce(
        (s, l) => s + (l.quantity * l.unit_price * l.tax_rate) / 100,
        0,
      );
      const total = subtotal + tax_total;

      const { data: bill, error } = await supabase
        .from("supplier_bills")
        .insert({
          company_id: companyId!,
          supplier_id: input.supplier_id,
          bill_number: input.bill_number,
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
        bill_id: bill.id,
        position: i,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        line_total: l.quantity * l.unit_price * (1 + l.tax_rate / 100),
      }));
      if (linesPayload.length > 0) {
        const { error: lineErr } = await supabase.from("bill_lines").insert(linesPayload);
        if (lineErr) throw lineErr;
      }

      return bill.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
