import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type CreditNoteSource = "invoice" | "pos_order" | "manual";
export type CreditNoteStatus = "draft" | "issued" | "applied" | "void";
export type AllocationTarget = "invoice" | "customer_credit" | "cash_refund";

export interface CreditNoteRow {
  id: string;
  company_id: string;
  credit_note_number: string;
  source_type: CreditNoteSource;
  source_invoice_id: string | null;
  source_pos_order_id: string | null;
  customer_id: string | null;
  status: CreditNoteStatus;
  issue_date: string;
  reason: string | null;
  notes: string | null;
  restock: boolean;
  currency: string;
  subtotal: number;
  tax_total: number;
  total: number;
  amount_allocated: number;
  created_at: string;
}

export interface CreditNoteLineRow {
  id: string;
  credit_note_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  product_id: string | null;
  source_line_id: string | null;
  source_line_type: string | null;
}

export interface CreditNoteAllocationRow {
  id: string;
  credit_note_id: string;
  target_type: AllocationTarget;
  target_invoice_id: string | null;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface CreditNoteListItem extends CreditNoteRow {
  customer_name: string | null;
  source_label: string | null;
}

// ---------- Queries ----------

export function useCreditNotes() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["credit-notes", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_notes")
        .select(
          "*, customers(name), customer_invoices:source_invoice_id(invoice_number), pos_orders:source_pos_order_id(order_number)",
        )
        .eq("company_id", companyId!)
        .order("issue_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Row = CreditNoteRow & {
        customers: { name: string } | null;
        customer_invoices: { invoice_number: string } | null;
        pos_orders: { order_number: string } | null;
      };
      return (data ?? []).map((r) => {
        const row = r as Row;
        const source_label =
          row.customer_invoices?.invoice_number ??
          row.pos_orders?.order_number ??
          null;
        return {
          ...row,
          customer_name: row.customers?.name ?? null,
          source_label,
        } as CreditNoteListItem;
      });
    },
  });
}

export function useCreditNote(id: string | undefined) {
  return useQuery({
    queryKey: ["credit-note", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: note, error } = await supabase
        .from("credit_notes")
        .select(
          "*, customers(id, name, email), customer_invoices:source_invoice_id(id, invoice_number, total, amount_paid), pos_orders:source_pos_order_id(id, order_number, total, warehouse_id)",
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!note) return null;

      const [linesRes, allocsRes, refundsRes] = await Promise.all([
        supabase
          .from("credit_note_lines")
          .select("*")
          .eq("credit_note_id", id!)
          .order("position"),
        supabase
          .from("credit_note_allocations")
          .select("*, customer_invoices:target_invoice_id(invoice_number)")
          .eq("credit_note_id", id!)
          .order("created_at"),
        supabase
          .from("cash_refunds")
          .select("*")
          .eq("credit_note_id", id!)
          .order("paid_at", { ascending: false }),
      ]);
      return {
        note,
        lines: (linesRes.data ?? []) as CreditNoteLineRow[],
        allocations: (allocsRes.data ?? []) as Array<
          CreditNoteAllocationRow & {
            customer_invoices: { invoice_number: string } | null;
          }
        >,
        cash_refunds: refundsRes.data ?? [],
      };
    },
  });
}

export function useRefundsForInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["refunds-by-invoice", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_notes")
        .select("id, credit_note_number, total, status, issue_date, amount_allocated")
        .eq("source_invoice_id", invoiceId!)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRefundsForPosOrder(posOrderId: string | undefined) {
  return useQuery({
    queryKey: ["refunds-by-pos-order", posOrderId],
    enabled: !!posOrderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_notes")
        .select("id, credit_note_number, total, status, issue_date, amount_allocated")
        .eq("source_pos_order_id", posOrderId!)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCustomerCreditBalance(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customer-credit-balance", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_credit_balance")
        .select("*")
        .eq("customer_id", customerId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ---------- Source loaders for the create flow ----------

export function useInvoiceForRefund(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice-for-refund", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const [invRes, linesRes, refundsRes] = await Promise.all([
        supabase
          .from("customer_invoices")
          .select("*, customers(id, name, email)")
          .eq("id", invoiceId!)
          .maybeSingle(),
        supabase
          .from("invoice_lines")
          .select("*")
          .eq("invoice_id", invoiceId!)
          .order("position"),
        supabase
          .from("credit_note_lines")
          .select("source_line_id, quantity, credit_notes!inner(source_invoice_id, status)")
          .eq("credit_notes.source_invoice_id", invoiceId!)
          .neq("credit_notes.status", "void"),
      ]);
      if (invRes.error) throw invRes.error;
      const refundedQtyByLine = new Map<string, number>();
      type RefRow = { source_line_id: string | null; quantity: number };
      for (const r of (refundsRes.data ?? []) as RefRow[]) {
        if (!r.source_line_id) continue;
        refundedQtyByLine.set(
          r.source_line_id,
          (refundedQtyByLine.get(r.source_line_id) ?? 0) + Number(r.quantity ?? 0),
        );
      }
      return {
        invoice: invRes.data,
        lines: (linesRes.data ?? []).map((l) => ({
          ...l,
          refunded_qty: refundedQtyByLine.get(l.id) ?? 0,
        })),
      };
    },
  });
}

export function usePosOrderForRefund(orderId: string | undefined) {
  return useQuery({
    queryKey: ["pos-order-for-refund", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const [orderRes, linesRes, refundsRes] = await Promise.all([
        supabase
          .from("pos_orders")
          .select("*, customers(id, name, email)")
          .eq("id", orderId!)
          .maybeSingle(),
        supabase
          .from("pos_order_lines")
          .select("*")
          .eq("order_id", orderId!)
          .order("position"),
        supabase
          .from("credit_note_lines")
          .select("source_line_id, quantity, credit_notes!inner(source_pos_order_id, status)")
          .eq("credit_notes.source_pos_order_id", orderId!)
          .neq("credit_notes.status", "void"),
      ]);
      if (orderRes.error) throw orderRes.error;
      const refundedQtyByLine = new Map<string, number>();
      type RefRow = { source_line_id: string | null; quantity: number };
      for (const r of (refundsRes.data ?? []) as RefRow[]) {
        if (!r.source_line_id) continue;
        refundedQtyByLine.set(
          r.source_line_id,
          (refundedQtyByLine.get(r.source_line_id) ?? 0) + Number(r.quantity ?? 0),
        );
      }
      return {
        order: orderRes.data,
        lines: (linesRes.data ?? []).map((l) => ({
          ...l,
          refunded_qty: refundedQtyByLine.get(l.id) ?? 0,
        })),
      };
    },
  });
}

// ---------- Create / Issue refund ----------

async function nextCreditNoteNumber(companyId: string) {
  const { count } = await supabase
    .from("credit_notes")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `CN-${String((count ?? 0) + 1).padStart(5, "0")}`;
}

export interface RefundLineInput {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  product_id: string | null;
  source_line_id: string | null;
  source_line_type: "invoice_line" | "pos_order_line" | null;
}

export interface AllocationInput {
  target_type: AllocationTarget;
  amount: number;
  target_invoice_id?: string | null;
  /** Only used for cash_refund */
  refund_method?: "cash" | "card" | "bank_transfer" | "other";
  refund_reference?: string | null;
  branch_id?: string | null;
  register_id?: string | null;
  session_id?: string | null;
  note?: string | null;
}

export interface CreateRefundInput {
  source_type: Exclude<CreditNoteSource, "manual">;
  source_invoice_id?: string | null;
  source_pos_order_id?: string | null;
  customer_id: string | null;
  reason: string | null;
  notes?: string | null;
  restock: boolean;
  warehouse_id?: string | null; // for restocking POS items
  lines: RefundLineInput[];
  allocations: AllocationInput[];
}

export function useCreateRefundMutation() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateRefundInput) => {
      if (!companyId) throw new Error("Missing company");
      if (input.lines.length === 0) throw new Error("Add at least one refund line");

      // ---- totals ----
      let subtotal = 0;
      let taxTotal = 0;
      const computed = input.lines.map((l) => {
        const net = l.unit_price * l.quantity;
        const tax = net * (l.tax_rate / 100);
        subtotal += net;
        taxTotal += tax;
        return { net, tax, line_total: net + tax };
      });
      const total = subtotal + taxTotal;

      const allocSum = input.allocations.reduce((s, a) => s + Number(a.amount || 0), 0);
      if (Math.abs(allocSum - total) > 0.01) {
        throw new Error(
          `Allocations (${allocSum.toFixed(2)}) must equal refund total (${total.toFixed(2)})`,
        );
      }

      const number = await nextCreditNoteNumber(companyId);

      // ---- credit note ----
      const { data: note, error: nErr } = await supabase
        .from("credit_notes")
        .insert({
          company_id: companyId,
          credit_note_number: number,
          source_type: input.source_type,
          source_invoice_id: input.source_invoice_id ?? null,
          source_pos_order_id: input.source_pos_order_id ?? null,
          customer_id: input.customer_id,
          reason: input.reason,
          notes: input.notes ?? null,
          restock: input.restock,
          status: "issued",
          subtotal,
          tax_total: taxTotal,
          total,
          amount_allocated: total,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (nErr) throw nErr;

      // ---- lines ----
      const lineRows = input.lines.map((l, i) => ({
        credit_note_id: note.id,
        position: i,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        tax_amount: computed[i].tax,
        line_total: computed[i].line_total,
        product_id: l.product_id,
        source_line_id: l.source_line_id,
        source_line_type: l.source_line_type,
      }));
      const { error: lErr } = await supabase.from("credit_note_lines").insert(lineRows);
      if (lErr) throw lErr;

      // ---- allocations ----
      for (const a of input.allocations) {
        if (Number(a.amount || 0) <= 0) continue;

        await supabase.from("credit_note_allocations").insert({
          credit_note_id: note.id,
          target_type: a.target_type,
          target_invoice_id: a.target_invoice_id ?? null,
          amount: a.amount,
          note: a.note ?? null,
        });

        if (a.target_type === "invoice" && a.target_invoice_id) {
          // Reduce invoice balance via a refund-style adjustment: bump amount_paid
          const { data: inv } = await supabase
            .from("customer_invoices")
            .select("total, amount_paid")
            .eq("id", a.target_invoice_id)
            .maybeSingle();
          if (inv) {
            const newPaid = Number(inv.amount_paid) + Number(a.amount);
            const newStatus =
              newPaid >= Number(inv.total) ? "paid" : newPaid > 0 ? "partial" : "sent";
            await supabase
              .from("customer_invoices")
              .update({ amount_paid: newPaid, status: newStatus })
              .eq("id", a.target_invoice_id);
          }
        }

        if (a.target_type === "customer_credit" && input.customer_id) {
          // upsert balance
          const { data: existing } = await supabase
            .from("customer_credit_balance")
            .select("id, balance")
            .eq("customer_id", input.customer_id)
            .maybeSingle();
          if (existing) {
            await supabase
              .from("customer_credit_balance")
              .update({ balance: Number(existing.balance) + Number(a.amount) })
              .eq("id", existing.id);
          } else {
            await supabase.from("customer_credit_balance").insert({
              company_id: companyId,
              customer_id: input.customer_id,
              balance: a.amount,
            });
          }
        }

        if (a.target_type === "cash_refund") {
          await supabase.from("cash_refunds").insert({
            company_id: companyId,
            credit_note_id: note.id,
            amount: a.amount,
            method: a.refund_method ?? "cash",
            reference: a.refund_reference ?? null,
            branch_id: a.branch_id ?? null,
            register_id: a.register_id ?? null,
            session_id: a.session_id ?? null,
            created_by: user?.id,
          });

          // Negative payment to mirror cash going back to customer
          if (input.source_invoice_id) {
            await supabase.from("payments").insert({
              company_id: companyId,
              invoice_id: input.source_invoice_id,
              party_type: "customer",
              party_id: input.customer_id ?? "00000000-0000-0000-0000-000000000000",
              direction: "out",
              method:
                a.refund_method === "card"
                  ? "card"
                  : a.refund_method === "bank_transfer"
                    ? "bank_transfer"
                    : a.refund_method === "other"
                      ? "other"
                      : "cash",
              amount: a.amount,
              reference: a.refund_reference ?? `Refund ${number}`,
              status: "completed",
              notes: `Cash refund for credit note ${number}`,
              created_by: user?.id,
            });
          }

          // Cash session event when paying back from open till
          if (a.session_id && a.refund_method === "cash") {
            await supabase.from("cash_session_events").insert({
              session_id: a.session_id,
              type: "refund",
              amount: a.amount,
              reference: number,
              created_by: user?.id,
            });
          }
        }
      }

      // ---- restock for goods lines ----
      if (input.restock && input.warehouse_id) {
        for (const l of input.lines) {
          if (!l.product_id) continue;
          // Insert positive stock movement
          await supabase.from("stock_movements").insert({
            company_id: companyId,
            product_id: l.product_id,
            warehouse_id: input.warehouse_id,
            type: "in",
            quantity: l.quantity,
            reference: number,
            notes: "Refund restock",
            created_by: user?.id,
          });

          const { data: existing } = await supabase
            .from("stock_levels")
            .select("id, quantity")
            .eq("product_id", l.product_id)
            .eq("warehouse_id", input.warehouse_id)
            .maybeSingle();
          if (existing) {
            await supabase
              .from("stock_levels")
              .update({ quantity: Number(existing.quantity) + Number(l.quantity) })
              .eq("id", existing.id);
          } else {
            await supabase.from("stock_levels").insert({
              company_id: companyId,
              product_id: l.product_id,
              warehouse_id: input.warehouse_id,
              quantity: l.quantity,
            });
          }
        }
      }

      // Update POS order status if fully refunded
      if (input.source_pos_order_id) {
        const { data: posOrder } = await supabase
          .from("pos_orders")
          .select("total")
          .eq("id", input.source_pos_order_id)
          .maybeSingle();
        if (posOrder) {
          const { data: refundsAgg } = await supabase
            .from("credit_notes")
            .select("total")
            .eq("source_pos_order_id", input.source_pos_order_id)
            .neq("status", "void");
          const refundedSum = (refundsAgg ?? []).reduce(
            (s, r) => s + Number(r.total ?? 0),
            0,
          );
          const status =
            refundedSum >= Number(posOrder.total) - 0.01
              ? "refunded"
              : "partially_refunded";
          await supabase
            .from("pos_orders")
            .update({ status })
            .eq("id", input.source_pos_order_id);
        }
      }

      return note.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit-notes"] });
      qc.invalidateQueries({ queryKey: ["credit-note"] });
      qc.invalidateQueries({ queryKey: ["refunds-by-invoice"] });
      qc.invalidateQueries({ queryKey: ["refunds-by-pos-order"] });
      qc.invalidateQueries({ queryKey: ["customer-credit-balance"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
      qc.invalidateQueries({ queryKey: ["pos-orders"] });
      qc.invalidateQueries({ queryKey: ["pos-order"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
    },
  });
}
