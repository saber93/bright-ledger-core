import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type SalesOrderStatus =
  | "draft"
  | "quotation"
  | "confirmed"
  | "fulfilled"
  | "invoiced"
  | "cancelled";

export interface SalesOrder {
  id: string;
  company_id: string;
  customer_id: string;
  order_number: string;
  order_date: string;
  expected_delivery_date: string | null;
  status: SalesOrderStatus;
  currency: string;
  subtotal: number;
  tax_total: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesOrderLine {
  id: string;
  order_id: string;
  product_id: string | null;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
}

export interface SalesOrderWithCustomer extends SalesOrder {
  customer_name: string;
}

export function useSalesOrders() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["sales-orders", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*, customers!inner(name)")
        .eq("company_id", companyId!)
        .order("order_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: { customers: { name: string } } & SalesOrder) => ({
        ...row,
        customer_name: row.customers?.name ?? "Unknown",
      })) as SalesOrderWithCustomer[];
    },
  });
}

export function useSalesOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["sales-order", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("sales_orders")
        .select("*, customers(id, name, email, phone, address_line1, city, country)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!order) return null;

      const { data: lines } = await supabase
        .from("sales_order_lines")
        .select("*")
        .eq("order_id", id!)
        .order("position");

      return { order, lines: (lines ?? []) as SalesOrderLine[] };
    },
  });
}

export function useUpdateSalesOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SalesOrderStatus }) => {
      const { error } = await supabase.from("sales_orders").update({ status }).eq("id", id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      qc.invalidateQueries({ queryKey: ["sales-order", id] });
    },
  });
}

export function useConvertSalesOrderToInvoice() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data: order, error: oErr } = await supabase
        .from("sales_orders")
        .select("*")
        .eq("id", orderId)
        .single();
      if (oErr) throw oErr;
      if (order.status === "invoiced") throw new Error("Order is already invoiced");
      if (order.status === "cancelled") throw new Error("Cancelled orders cannot be invoiced");

      const { data: lines, error: lErr } = await supabase
        .from("sales_order_lines")
        .select("*")
        .eq("order_id", orderId)
        .order("position");
      if (lErr) throw lErr;

      // Build invoice number from prefix + timestamp suffix
      const { data: settings } = await supabase
        .from("company_settings")
        .select("invoice_prefix")
        .eq("company_id", companyId!)
        .maybeSingle();
      const prefix = settings?.invoice_prefix ?? "INV-";
      const invoice_number = `${prefix}${order.order_number.replace(/^[A-Za-z-]+/, "")}`;

      const today = new Date().toISOString().slice(0, 10);
      const due = new Date();
      due.setDate(due.getDate() + 30);
      const due_date = due.toISOString().slice(0, 10);

      const { data: invoice, error: iErr } = await supabase
        .from("customer_invoices")
        .insert({
          company_id: companyId!,
          customer_id: order.customer_id,
          invoice_number,
          issue_date: today,
          due_date,
          status: "draft",
          currency: order.currency,
          subtotal: order.subtotal,
          tax_total: order.tax_total,
          total: order.total,
          notes: `Generated from sales order ${order.order_number}`,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (iErr) throw iErr;

      if ((lines ?? []).length > 0) {
        const payload = (lines ?? []).map((l) => ({
          invoice_id: invoice.id,
          position: l.position,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          line_total: l.line_total,
        }));
        const { error: linesErr } = await supabase.from("invoice_lines").insert(payload);
        if (linesErr) throw linesErr;
      }

      await supabase.from("sales_orders").update({ status: "invoiced" }).eq("id", orderId);

      return { invoiceId: invoice.id as string, orderId };
    },
    onSuccess: ({ orderId }) => {
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      qc.invalidateQueries({ queryKey: ["sales-order", orderId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
