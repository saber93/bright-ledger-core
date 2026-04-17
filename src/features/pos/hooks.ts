import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

// ---------- Types ----------

export type PosOrderStatus =
  | "draft"
  | "held"
  | "completed"
  | "refunded"
  | "partially_refunded"
  | "cancelled";

export type PosPaymentMethod = "cash" | "card" | "transfer" | "credit" | "mixed" | "other";

export type CashSessionStatus = "open" | "closed";

export interface PosOrderRow {
  id: string;
  order_number: string;
  status: PosOrderStatus;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  currency: string;
  customer_id: string | null;
  branch_id: string;
  register_id: string;
  warehouse_id: string | null;
  session_id: string | null;
  invoice_id: string | null;
  cashier_id: string | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface PosOrderLineRow {
  id: string;
  order_id: string;
  position: number;
  product_id: string | null;
  description: string;
  is_service: boolean;
  list_price: number;
  unit_price: number;
  quantity: number;
  discount: number;
  tax_rate: number;
  tax_rate_id: string | null;
  tax_amount: number;
  line_total: number;
  price_override_reason: string | null;
  note: string | null;
}

export interface PosPaymentRow {
  id: string;
  order_id: string;
  method: PosPaymentMethod;
  amount: number;
  reference: string | null;
  change_due: number;
  created_at: string;
}

export interface CashSessionRow {
  id: string;
  branch_id: string;
  register_id: string;
  company_id: string;
  status: CashSessionStatus;
  opening_cash: number;
  expected_cash: number;
  counted_cash: number | null;
  variance: number | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
}

// ---------- Queries ----------

export function usePosOrders(limit = 100) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["pos-orders", companyId, limit],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pos_orders")
        .select("*, customers(name), pos_registers(code, name), branches(code, name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Array<
        PosOrderRow & {
          customers: { name: string } | null;
          pos_registers: { code: string; name: string } | null;
          branches: { code: string; name: string } | null;
        }
      >;
    },
  });
}

export function usePosOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["pos-order", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("pos_orders")
        .select(
          "*, customers(id, name, email), pos_registers(code, name), branches(code, name), warehouses(code, name)",
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!order) return null;

      const [linesRes, paymentsRes, invoiceRes, paymentRecordsRes] = await Promise.all([
        supabase.from("pos_order_lines").select("*").eq("order_id", id!).order("position"),
        supabase
          .from("pos_payments")
          .select("*")
          .eq("order_id", id!)
          .order("created_at"),
        order.invoice_id
          ? supabase
              .from("customer_invoices")
              .select("*")
              .eq("id", order.invoice_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        order.invoice_id
          ? supabase
              .from("payments")
              .select("*")
              .eq("invoice_id", order.invoice_id)
              .order("paid_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      return {
        order: order as PosOrderRow & {
          customers: { id: string; name: string; email: string | null } | null;
          pos_registers: { code: string; name: string } | null;
          branches: { code: string; name: string } | null;
          warehouses: { code: string; name: string } | null;
        },
        lines: (linesRes.data ?? []) as PosOrderLineRow[],
        pos_payments: (paymentsRes.data ?? []) as PosPaymentRow[],
        invoice: invoiceRes.data,
        payment_records: (paymentRecordsRes.data ?? []) as Array<{
          id: string;
          amount: number;
          method: string;
          paid_at: string;
          reference: string | null;
        }>,
      };
    },
  });
}

export function useHeldPosOrders() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["pos-orders-held", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pos_orders")
        .select("*, customers(name)")
        .eq("company_id", companyId!)
        .eq("status", "held")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<PosOrderRow & { customers: { name: string } | null }>;
    },
  });
}

export function useHeldPosOrderDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["pos-order-held-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const [orderRes, linesRes] = await Promise.all([
        supabase.from("pos_orders").select("*").eq("id", id!).maybeSingle(),
        supabase.from("pos_order_lines").select("*").eq("order_id", id!).order("position"),
      ]);
      if (orderRes.error) throw orderRes.error;
      return {
        order: orderRes.data as PosOrderRow | null,
        lines: (linesRes.data ?? []) as PosOrderLineRow[],
      };
    },
  });
}

// ---------- Cash sessions ----------

export function useOpenCashSession(registerId: string | undefined) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["cash-session-open", companyId, registerId],
    enabled: !!companyId && !!registerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sessions")
        .select("*")
        .eq("company_id", companyId!)
        .eq("register_id", registerId!)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CashSessionRow | null;
    },
  });
}

export function useCashSessions(limit = 50) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["cash-sessions", companyId, limit],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sessions")
        .select("*, pos_registers(code, name), branches(code, name)")
        .eq("company_id", companyId!)
        .order("opened_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Array<
        CashSessionRow & {
          pos_registers: { code: string; name: string } | null;
          branches: { code: string; name: string } | null;
        }
      >;
    },
  });
}

export function useCashSessionDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["cash-session", id],
    enabled: !!id,
    queryFn: async () => {
      const [sessionRes, eventsRes] = await Promise.all([
        supabase
          .from("cash_sessions")
          .select("*, pos_registers(code, name), branches(code, name)")
          .eq("id", id!)
          .maybeSingle(),
        supabase
          .from("cash_session_events")
          .select("*")
          .eq("session_id", id!)
          .order("created_at"),
      ]);
      if (sessionRes.error) throw sessionRes.error;
      return {
        session: sessionRes.data,
        events: eventsRes.data ?? [],
      };
    },
  });
}

export function useOpenSessionMutation() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      branch_id: string;
      register_id: string;
      opening_cash: number;
      notes?: string | null;
    }) => {
      const { data: session, error } = await supabase
        .from("cash_sessions")
        .insert({
          company_id: companyId!,
          branch_id: input.branch_id,
          register_id: input.register_id,
          opening_cash: input.opening_cash,
          expected_cash: input.opening_cash,
          status: "open",
          notes: input.notes ?? null,
          opened_by: user?.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      await supabase.from("cash_session_events").insert({
        session_id: session.id,
        type: "opening",
        amount: input.opening_cash,
        created_by: user?.id,
      });
      return session.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-session-open"] });
      qc.invalidateQueries({ queryKey: ["cash-sessions"] });
    },
  });
}

export function useCashEventMutation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      session_id: string;
      type: "cash_in" | "cash_out" | "payout";
      amount: number;
      note?: string | null;
      reference?: string | null;
    }) => {
      const { error } = await supabase.from("cash_session_events").insert({
        session_id: input.session_id,
        type: input.type,
        amount: input.amount,
        note: input.note ?? null,
        reference: input.reference ?? null,
        created_by: user?.id,
      });
      if (error) throw error;

      // Recompute expected_cash from events
      await recomputeExpectedCash(input.session_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-session-open"] });
      qc.invalidateQueries({ queryKey: ["cash-sessions"] });
      qc.invalidateQueries({ queryKey: ["cash-session"] });
    },
  });
}

export function useCloseSessionMutation() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      session_id: string;
      counted_cash: number;
      notes?: string | null;
    }) => {
      // Recompute expected before closing
      const expected = await recomputeExpectedCash(input.session_id);

      const variance = Number(input.counted_cash) - expected;

      const { error } = await supabase
        .from("cash_sessions")
        .update({
          status: "closed",
          counted_cash: input.counted_cash,
          variance,
          closed_at: new Date().toISOString(),
          closed_by: user?.id,
          notes: input.notes ?? null,
        })
        .eq("id", input.session_id);
      if (error) throw error;

      await supabase.from("cash_session_events").insert({
        session_id: input.session_id,
        type: "closing",
        amount: input.counted_cash,
        note: variance !== 0 ? `Variance ${variance.toFixed(2)}` : null,
        created_by: user?.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-session-open"] });
      qc.invalidateQueries({ queryKey: ["cash-sessions"] });
      qc.invalidateQueries({ queryKey: ["cash-session"] });
    },
  });
}

async function recomputeExpectedCash(sessionId: string): Promise<number> {
  const { data: events } = await supabase
    .from("cash_session_events")
    .select("type, amount")
    .eq("session_id", sessionId);

  let expected = 0;
  for (const e of events ?? []) {
    const amt = Number(e.amount) || 0;
    switch (e.type) {
      case "opening":
      case "sale":
      case "cash_in":
        expected += amt;
        break;
      case "refund":
      case "cash_out":
      case "payout":
        expected -= amt;
        break;
      // 'closing' is a marker, not a balance change
    }
  }
  await supabase
    .from("cash_sessions")
    .update({ expected_cash: expected })
    .eq("id", sessionId);
  return expected;
}

// ---------- Cart types & checkout ----------

export interface CartLineInput {
  product_id: string | null;
  description: string;
  is_service: boolean;
  list_price: number;
  unit_price: number;
  quantity: number;
  discount: number; // absolute amount applied per line
  tax_rate: number; // percentage
  tax_rate_id: string | null;
  price_override_reason: string | null;
  note: string | null;
}

export interface CheckoutPaymentInput {
  method: PosPaymentMethod;
  amount: number;
  reference?: string | null;
  change_due?: number;
}

export interface CheckoutInput {
  branch_id: string;
  register_id: string;
  warehouse_id: string | null;
  session_id: string | null;
  customer_id: string | null;
  notes: string | null;
  lines: CartLineInput[];
  payments: CheckoutPaymentInput[];
  on_credit: boolean; // if true, no payment posted now, invoice stays open
  resume_from_held_id?: string | null;
}

interface CheckoutResult {
  pos_order_id: string;
  invoice_id: string;
  order_number: string;
}

export function useCheckoutMutation() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();

  return useMutation({
    mutationFn: async (input: CheckoutInput): Promise<CheckoutResult> => {
      if (!companyId) throw new Error("Missing company");
      if (input.lines.length === 0) throw new Error("Cart is empty");

      // ---------- Totals ----------
      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      const lineTotals: number[] = [];
      const lineTaxAmounts: number[] = [];

      for (const l of input.lines) {
        const gross = l.unit_price * l.quantity;
        const afterDiscount = Math.max(0, gross - l.discount);
        const taxAmt = afterDiscount * (l.tax_rate / 100);
        const lineTotal = afterDiscount + taxAmt;
        subtotal += afterDiscount;
        discountTotal += l.discount;
        taxTotal += taxAmt;
        lineTotals.push(lineTotal);
        lineTaxAmounts.push(taxAmt);
      }
      const total = subtotal + taxTotal;

      // ---------- Numbers ----------
      const orderNumber = await nextNumber(companyId, "POS-");
      const invoiceNumber = await nextInvoiceNumber(companyId);

      // ---------- Customer (POS Walk-in fallback) ----------
      let customerId = input.customer_id;
      if (!customerId) {
        customerId = await getOrCreateWalkInCustomer(companyId);
      }

      // ---------- Insert invoice (paid or unpaid) ----------
      const amountPaidAgg = input.on_credit
        ? 0
        : input.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      // We treat invoice.amount_paid = sum of payments routed to it (cash/card/transfer/mixed),
      // but exclude store-credit / on_credit slice (kept as receivable).
      const settledByPayments = input.on_credit
        ? 0
        : Math.min(amountPaidAgg, total);

      const invoiceStatus =
        settledByPayments >= total ? "paid" : settledByPayments > 0 ? "partial" : "sent";

      const { data: invoice, error: invErr } = await supabase
        .from("customer_invoices")
        .insert({
          company_id: companyId,
          customer_id: customerId,
          invoice_number: invoiceNumber,
          issue_date: new Date().toISOString().slice(0, 10),
          due_date: input.on_credit
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          status: invoiceStatus,
          notes: input.notes,
          subtotal,
          tax_total: taxTotal,
          total,
          amount_paid: settledByPayments,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (invErr) throw invErr;

      // Invoice lines
      const invLines = input.lines.map((l, i) => ({
        invoice_id: invoice.id,
        position: i,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        // store gross-of-tax line total to mirror existing invoice convention
        line_total: lineTotals[i],
      }));
      const { error: invLinesErr } = await supabase.from("invoice_lines").insert(invLines);
      if (invLinesErr) throw invLinesErr;

      // ---------- Insert POS order ----------
      let posOrderId: string;
      if (input.resume_from_held_id) {
        // Re-use held order id: update + clear lines, re-insert
        const { error: updErr } = await supabase
          .from("pos_orders")
          .update({
            status: "completed",
            order_number: orderNumber,
            customer_id: customerId,
            branch_id: input.branch_id,
            register_id: input.register_id,
            warehouse_id: input.warehouse_id,
            session_id: input.session_id,
            cashier_id: user?.id,
            subtotal,
            discount_total: discountTotal,
            tax_total: taxTotal,
            total,
            invoice_id: invoice.id,
            notes: input.notes,
            completed_at: new Date().toISOString(),
          })
          .eq("id", input.resume_from_held_id);
        if (updErr) throw updErr;
        posOrderId = input.resume_from_held_id;
        await supabase.from("pos_order_lines").delete().eq("order_id", posOrderId);
      } else {
        const { data: posOrder, error: posErr } = await supabase
          .from("pos_orders")
          .insert({
            company_id: companyId,
            branch_id: input.branch_id,
            register_id: input.register_id,
            warehouse_id: input.warehouse_id,
            session_id: input.session_id,
            customer_id: customerId,
            cashier_id: user?.id,
            order_number: orderNumber,
            status: "completed",
            subtotal,
            discount_total: discountTotal,
            tax_total: taxTotal,
            total,
            invoice_id: invoice.id,
            notes: input.notes,
            completed_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (posErr) throw posErr;
        posOrderId = posOrder.id;
      }

      // POS lines
      const posLines = input.lines.map((l, i) => ({
        order_id: posOrderId,
        position: i,
        product_id: l.product_id,
        description: l.description,
        is_service: l.is_service,
        list_price: l.list_price,
        unit_price: l.unit_price,
        quantity: l.quantity,
        discount: l.discount,
        tax_rate: l.tax_rate,
        tax_rate_id: l.tax_rate_id,
        tax_amount: lineTaxAmounts[i],
        line_total: lineTotals[i],
        price_override_reason: l.price_override_reason,
        note: l.note,
      }));
      const { error: posLinesErr } = await supabase.from("pos_order_lines").insert(posLines);
      if (posLinesErr) throw posLinesErr;

      // ---------- POS payments + accounting payments ----------
      let cashAmount = 0;
      if (!input.on_credit) {
        for (const p of input.payments) {
          if (Number(p.amount || 0) <= 0) continue;
          await supabase.from("pos_payments").insert({
            order_id: posOrderId,
            method: p.method,
            amount: p.amount,
            reference: p.reference ?? null,
            change_due: p.change_due ?? 0,
          });

          // Map to accounting payment
          const accountingMethod: "cash" | "card" | "bank_transfer" | "other" =
            p.method === "cash"
              ? "cash"
              : p.method === "card"
                ? "card"
                : p.method === "transfer"
                  ? "bank_transfer"
                  : "other";

          await supabase.from("payments").insert({
            company_id: companyId,
            invoice_id: invoice.id,
            party_type: "customer",
            party_id: customerId,
            direction: "in",
            method: accountingMethod,
            amount: p.amount,
            currency: "USD",
            reference: p.reference ?? `POS ${orderNumber}`,
            status: "completed",
            paid_at: new Date().toISOString(),
            created_by: user?.id,
          });

          if (p.method === "cash") cashAmount += Number(p.amount);
        }
      }

      // ---------- Cash session event ----------
      if (input.session_id && cashAmount > 0) {
        await supabase.from("cash_session_events").insert({
          session_id: input.session_id,
          type: "sale",
          amount: cashAmount,
          reference: orderNumber,
          created_by: user?.id,
        });
        await recomputeExpectedCash(input.session_id);
      }

      // ---------- Stock movements ----------
      if (input.warehouse_id) {
        for (const l of input.lines) {
          if (!l.product_id || l.is_service) continue;
          // Insert stock movement (out)
          await supabase.from("stock_movements").insert({
            company_id: companyId,
            product_id: l.product_id,
            warehouse_id: input.warehouse_id,
            type: "out",
            quantity: l.quantity,
            reference: orderNumber,
            notes: `POS sale`,
            created_by: user?.id,
          });

          // Adjust stock_levels
          const { data: existing } = await supabase
            .from("stock_levels")
            .select("id, quantity")
            .eq("product_id", l.product_id)
            .eq("warehouse_id", input.warehouse_id)
            .maybeSingle();
          if (existing) {
            await supabase
              .from("stock_levels")
              .update({ quantity: Number(existing.quantity) - Number(l.quantity) })
              .eq("id", existing.id);
          } else {
            await supabase.from("stock_levels").insert({
              company_id: companyId,
              product_id: l.product_id,
              warehouse_id: input.warehouse_id,
              quantity: -Number(l.quantity),
            });
          }
        }
      }

      return { pos_order_id: posOrderId, invoice_id: invoice.id, order_number: orderNumber };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-orders"] });
      qc.invalidateQueries({ queryKey: ["pos-orders-held"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["cash-session-open"] });
    },
  });
}

// ---------- Hold cart ----------

export function useHoldCartMutation() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      branch_id: string;
      register_id: string;
      warehouse_id: string | null;
      session_id: string | null;
      customer_id: string | null;
      notes: string | null;
      lines: CartLineInput[];
    }) => {
      if (!companyId) throw new Error("Missing company");
      const orderNumber = await nextNumber(companyId, "HOLD-");

      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      const computed = input.lines.map((l) => {
        const gross = l.unit_price * l.quantity;
        const afterDiscount = Math.max(0, gross - l.discount);
        const taxAmt = afterDiscount * (l.tax_rate / 100);
        subtotal += afterDiscount;
        discountTotal += l.discount;
        taxTotal += taxAmt;
        return { afterDiscount, taxAmt, lineTotal: afterDiscount + taxAmt };
      });
      const total = subtotal + taxTotal;

      const { data: order, error } = await supabase
        .from("pos_orders")
        .insert({
          company_id: companyId,
          branch_id: input.branch_id,
          register_id: input.register_id,
          warehouse_id: input.warehouse_id,
          session_id: input.session_id,
          customer_id: input.customer_id,
          cashier_id: user?.id,
          order_number: orderNumber,
          status: "held",
          subtotal,
          discount_total: discountTotal,
          tax_total: taxTotal,
          total,
          notes: input.notes,
        })
        .select("id")
        .single();
      if (error) throw error;

      const linesPayload = input.lines.map((l, i) => ({
        order_id: order.id,
        position: i,
        product_id: l.product_id,
        description: l.description,
        is_service: l.is_service,
        list_price: l.list_price,
        unit_price: l.unit_price,
        quantity: l.quantity,
        discount: l.discount,
        tax_rate: l.tax_rate,
        tax_rate_id: l.tax_rate_id,
        tax_amount: computed[i].taxAmt,
        line_total: computed[i].lineTotal,
        price_override_reason: l.price_override_reason,
        note: l.note,
      }));
      await supabase.from("pos_order_lines").insert(linesPayload);
      return order.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-orders-held"] }),
  });
}

export function useDeleteHeldCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("pos_order_lines").delete().eq("order_id", id);
      const { error } = await supabase.from("pos_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-orders-held"] }),
  });
}

// ---------- Helpers ----------

async function nextNumber(companyId: string, prefix: string): Promise<string> {
  const { count } = await supabase
    .from("pos_orders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  const seq = (count ?? 0) + 1;
  const stamp = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  return `${prefix}${stamp}-${String(seq).padStart(5, "0")}`;
}

async function nextInvoiceNumber(companyId: string): Promise<string> {
  const { data: settings } = await supabase
    .from("company_settings")
    .select("invoice_prefix")
    .eq("company_id", companyId)
    .maybeSingle();
  const prefix = settings?.invoice_prefix ?? "INV-";
  const { count } = await supabase
    .from("customer_invoices")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  const seq = (count ?? 0) + 1;
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

async function getOrCreateWalkInCustomer(companyId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("company_id", companyId)
    .eq("name", "POS Walk-in")
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: companyId,
      name: "POS Walk-in",
      is_active: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
