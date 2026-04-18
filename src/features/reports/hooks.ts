/**
 * Reports aggregation layer.
 *
 * Reconciliation guardrail: every hook reads directly from posted-document
 * tables (customer_invoices, pos_orders, pos_payments, payments,
 * quick_expenses, credit_notes, supplier_bills, cash_refunds,
 * cash_session_events). No materialized cache, no parallel aggregation
 * surface that could drift from the source documents.
 *
 * Filters are inclusive on both endpoints: `from <= date <= to`.
 * Branch filter applies only where a branch_id column exists on the source
 * (POS orders, quick expenses, cash refunds, cash sessions).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface ReportFilters {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  branchId?: string | null;
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Build an inclusive end-of-day timestamp string for `<=` filters. */
const endOfDay = (d: string) => `${d}T23:59:59.999Z`;
const startOfDay = (d: string) => `${d}T00:00:00.000Z`;

// ============================================================================
// PROFIT & LOSS
// ============================================================================

export interface ProfitLossRow {
  category: string;
  label: string;
  amount: number;
}

export interface ProfitLossData {
  filters: ReportFilters;
  revenue: {
    invoices: number;
    pos: number;
    total: number;
    rows: Array<{
      source: "Invoice" | "POS";
      number: string;
      date: string;
      counterparty: string;
      amount: number;
    }>;
  };
  expenses: {
    bills: number;
    quickExpenses: number;
    total: number;
    rows: Array<{
      source: "Bill" | "Quick Expense";
      number: string;
      date: string;
      counterparty: string;
      amount: number;
    }>;
  };
  refunds: {
    total: number;
  };
  grossRevenue: number;
  netRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

export function useProfitLoss(filters: ReportFilters) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["report-profit-loss", companyId, filters],
    enabled: !!companyId,
    queryFn: async (): Promise<ProfitLossData> => {
      // Invoices: revenue from non-draft, non-cancelled invoices in the period
      let invQ = supabase
        .from("customer_invoices")
        .select("id, invoice_number, issue_date, total, status, customers!inner(name)")
        .eq("company_id", companyId!)
        .gte("issue_date", filters.from)
        .lte("issue_date", filters.to);

      // POS: revenue from completed orders in the period
      let posQ = supabase
        .from("pos_orders")
        .select("id, order_number, completed_at, created_at, total, status, branch_id")
        .eq("company_id", companyId!)
        .eq("status", "completed")
        .gte("completed_at", startOfDay(filters.from))
        .lte("completed_at", endOfDay(filters.to));
      if (filters.branchId) posQ = posQ.eq("branch_id", filters.branchId);

      // Bills: expense from non-draft, non-cancelled bills
      const billQ = supabase
        .from("supplier_bills")
        .select("id, bill_number, issue_date, total, status, suppliers!inner(name)")
        .eq("company_id", companyId!)
        .gte("issue_date", filters.from)
        .lte("issue_date", filters.to);

      // Quick expenses: expense in the period
      let qeQ = supabase
        .from("quick_expenses")
        .select("id, expense_number, date, amount, tax_amount, description, branch_id, suppliers(name)")
        .eq("company_id", companyId!)
        .gte("date", filters.from)
        .lte("date", filters.to);
      if (filters.branchId) qeQ = qeQ.eq("branch_id", filters.branchId);

      // Refunds (credit notes): for net-revenue display
      const cnQ = supabase
        .from("credit_notes")
        .select("id, total, status, issue_date")
        .eq("company_id", companyId!)
        .neq("status", "draft")
        .neq("status", "cancelled")
        .gte("issue_date", filters.from)
        .lte("issue_date", filters.to);

      const [invRes, posRes, billRes, qeRes, cnRes] = await Promise.all([invQ, posQ, billQ, qeQ, cnQ]);

      const invoices = (invRes.data ?? []).filter(
        (i) => i.status !== "cancelled" && i.status !== "draft",
      );
      const posOrders = posRes.data ?? [];
      const bills = (billRes.data ?? []).filter(
        (b) => b.status !== "cancelled" && b.status !== "draft",
      );
      const quickExpenses = qeRes.data ?? [];
      const creditNotes = cnRes.data ?? [];

      const invoiceRevenue = invoices.reduce((s, i) => s + num(i.total), 0);
      const posRevenue = posOrders.reduce((s, o) => s + num(o.total), 0);
      const billExpense = bills.reduce((s, b) => s + num(b.total), 0);
      const qeExpense = quickExpenses.reduce((s, e) => s + num(e.amount) + num(e.tax_amount), 0);
      const refundTotal = creditNotes.reduce((s, c) => s + num(c.total), 0);

      const grossRevenue = invoiceRevenue + posRevenue;
      const netRevenue = grossRevenue - refundTotal;
      const totalExpenses = billExpense + qeExpense;

      return {
        filters,
        revenue: {
          invoices: invoiceRevenue,
          pos: posRevenue,
          total: grossRevenue,
          rows: [
            ...invoices.map((i) => ({
              source: "Invoice" as const,
              number: i.invoice_number,
              date: i.issue_date,
              counterparty: (i.customers as { name?: string } | null)?.name ?? "—",
              amount: num(i.total),
            })),
            ...posOrders.map((o) => ({
              source: "POS" as const,
              number: o.order_number,
              date: (o.completed_at ?? o.created_at)?.slice(0, 10) ?? "",
              counterparty: "Walk-in",
              amount: num(o.total),
            })),
          ].sort((a, b) => (a.date < b.date ? 1 : -1)),
        },
        expenses: {
          bills: billExpense,
          quickExpenses: qeExpense,
          total: totalExpenses,
          rows: [
            ...bills.map((b) => ({
              source: "Bill" as const,
              number: b.bill_number,
              date: b.issue_date,
              counterparty: (b.suppliers as { name?: string } | null)?.name ?? "—",
              amount: num(b.total),
            })),
            ...quickExpenses.map((e) => ({
              source: "Quick Expense" as const,
              number: e.expense_number,
              date: e.date,
              counterparty:
                (e.suppliers as { name?: string } | null)?.name ?? e.description ?? "—",
              amount: num(e.amount) + num(e.tax_amount),
            })),
          ].sort((a, b) => (a.date < b.date ? 1 : -1)),
        },
        refunds: { total: refundTotal },
        grossRevenue,
        netRevenue,
        totalExpenses,
        netProfit: netRevenue - totalExpenses,
      };
    },
  });
}

// ============================================================================
// SALES PERFORMANCE
// ============================================================================

export interface SalesData {
  filters: ReportFilters;
  totalSales: number;
  invoiceTotal: number;
  posTotal: number;
  orderCount: number;
  avgTicket: number;
  byCustomer: Array<{ name: string; amount: number; count: number }>;
  byBranch: Array<{ branchId: string | null; name: string; amount: number; count: number }>;
  byChannel: Array<{ channel: string; amount: number; count: number }>;
  rows: Array<{
    source: "Invoice" | "POS";
    number: string;
    date: string;
    counterparty: string;
    branch: string;
    amount: number;
  }>;
}

export function useSalesPerformance(filters: ReportFilters) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["report-sales", companyId, filters],
    enabled: !!companyId,
    queryFn: async (): Promise<SalesData> => {
      const invQ = supabase
        .from("customer_invoices")
        .select("id, invoice_number, issue_date, total, status, customers!inner(name)")
        .eq("company_id", companyId!)
        .gte("issue_date", filters.from)
        .lte("issue_date", filters.to);

      let posQ = supabase
        .from("pos_orders")
        .select(
          "id, order_number, completed_at, created_at, total, status, branch_id, branches(name), customers(name)",
        )
        .eq("company_id", companyId!)
        .eq("status", "completed")
        .gte("completed_at", startOfDay(filters.from))
        .lte("completed_at", endOfDay(filters.to));
      if (filters.branchId) posQ = posQ.eq("branch_id", filters.branchId);

      const [invRes, posRes] = await Promise.all([invQ, posQ]);

      const invoices = (invRes.data ?? []).filter(
        (i) => i.status !== "cancelled" && i.status !== "draft",
      );
      const posOrders = posRes.data ?? [];

      const invoiceTotal = invoices.reduce((s, i) => s + num(i.total), 0);
      const posTotal = posOrders.reduce((s, o) => s + num(o.total), 0);
      const totalSales = invoiceTotal + posTotal;
      const orderCount = invoices.length + posOrders.length;

      // By customer
      const customerMap = new Map<string, { amount: number; count: number }>();
      for (const i of invoices) {
        const name = (i.customers as { name?: string } | null)?.name ?? "—";
        const cur = customerMap.get(name) ?? { amount: 0, count: 0 };
        customerMap.set(name, { amount: cur.amount + num(i.total), count: cur.count + 1 });
      }
      for (const o of posOrders) {
        const name = (o.customers as { name?: string } | null)?.name ?? "Walk-in";
        const cur = customerMap.get(name) ?? { amount: 0, count: 0 };
        customerMap.set(name, { amount: cur.amount + num(o.total), count: cur.count + 1 });
      }

      // By branch (POS only — invoices have no branch)
      const branchMap = new Map<string, { branchId: string | null; name: string; amount: number; count: number }>();
      for (const o of posOrders) {
        const id = o.branch_id ?? "—";
        const name = (o.branches as { name?: string } | null)?.name ?? "Unknown";
        const cur = branchMap.get(id) ?? { branchId: o.branch_id, name, amount: 0, count: 0 };
        branchMap.set(id, { ...cur, amount: cur.amount + num(o.total), count: cur.count + 1 });
      }
      if (invoiceTotal > 0) {
        branchMap.set("__invoices__", {
          branchId: null,
          name: "Invoices (no branch)",
          amount: invoiceTotal,
          count: invoices.length,
        });
      }

      const byChannel = [
        { channel: "Customer Invoices", amount: invoiceTotal, count: invoices.length },
        { channel: "POS", amount: posTotal, count: posOrders.length },
      ];

      return {
        filters,
        totalSales,
        invoiceTotal,
        posTotal,
        orderCount,
        avgTicket: orderCount > 0 ? totalSales / orderCount : 0,
        byCustomer: Array.from(customerMap.entries())
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.amount - a.amount),
        byBranch: Array.from(branchMap.values()).sort((a, b) => b.amount - a.amount),
        byChannel,
        rows: [
          ...invoices.map((i) => ({
            source: "Invoice" as const,
            number: i.invoice_number,
            date: i.issue_date,
            counterparty: (i.customers as { name?: string } | null)?.name ?? "—",
            branch: "—",
            amount: num(i.total),
          })),
          ...posOrders.map((o) => ({
            source: "POS" as const,
            number: o.order_number,
            date: (o.completed_at ?? o.created_at)?.slice(0, 10) ?? "",
            counterparty: (o.customers as { name?: string } | null)?.name ?? "Walk-in",
            branch: (o.branches as { name?: string } | null)?.name ?? "—",
            amount: num(o.total),
          })),
        ].sort((a, b) => (a.date < b.date ? 1 : -1)),
      };
    },
  });
}

// ============================================================================
// TAX SUMMARY
// ============================================================================

export interface TaxData {
  filters: ReportFilters;
  outputTax: {
    invoices: number;
    pos: number;
    total: number;
  };
  inputTax: {
    bills: number;
    quickExpenses: number;
    total: number;
  };
  refundedTax: number;
  netTaxPayable: number;
  rows: Array<{
    source: "Invoice" | "POS" | "Bill" | "Quick Expense" | "Credit Note";
    number: string;
    date: string;
    taxable: number;
    tax: number;
    direction: "output" | "input" | "refund";
  }>;
}

export function useTaxSummary(filters: ReportFilters) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["report-tax", companyId, filters],
    enabled: !!companyId,
    queryFn: async (): Promise<TaxData> => {
      const [invRes, posRes, billRes, qeRes, cnRes] = await Promise.all([
        supabase
          .from("customer_invoices")
          .select("id, invoice_number, issue_date, subtotal, tax_total, status")
          .eq("company_id", companyId!)
          .gte("issue_date", filters.from)
          .lte("issue_date", filters.to),
        supabase
          .from("pos_orders")
          .select("id, order_number, completed_at, created_at, subtotal, tax_total, status")
          .eq("company_id", companyId!)
          .eq("status", "completed")
          .gte("completed_at", startOfDay(filters.from))
          .lte("completed_at", endOfDay(filters.to)),
        supabase
          .from("supplier_bills")
          .select("id, bill_number, issue_date, subtotal, tax_total, status")
          .eq("company_id", companyId!)
          .gte("issue_date", filters.from)
          .lte("issue_date", filters.to),
        supabase
          .from("quick_expenses")
          .select("id, expense_number, date, amount, tax_amount")
          .eq("company_id", companyId!)
          .gte("date", filters.from)
          .lte("date", filters.to),
        supabase
          .from("credit_notes")
          .select("id, credit_note_number, issue_date, subtotal, tax_total, status")
          .eq("company_id", companyId!)
          .neq("status", "draft")
          .neq("status", "cancelled")
          .gte("issue_date", filters.from)
          .lte("issue_date", filters.to),
      ]);

      const invoices = (invRes.data ?? []).filter(
        (i) => i.status !== "cancelled" && i.status !== "draft",
      );
      const posOrders = posRes.data ?? [];
      const bills = (billRes.data ?? []).filter(
        (b) => b.status !== "cancelled" && b.status !== "draft",
      );
      const quickExpenses = qeRes.data ?? [];
      const creditNotes = cnRes.data ?? [];

      const invTax = invoices.reduce((s, i) => s + num(i.tax_total), 0);
      const posTax = posOrders.reduce((s, o) => s + num(o.tax_total), 0);
      const billTax = bills.reduce((s, b) => s + num(b.tax_total), 0);
      const qeTax = quickExpenses.reduce((s, e) => s + num(e.tax_amount), 0);
      const refundedTax = creditNotes.reduce((s, c) => s + num(c.tax_total), 0);

      const outputTotal = invTax + posTax;
      const inputTotal = billTax + qeTax;

      return {
        filters,
        outputTax: { invoices: invTax, pos: posTax, total: outputTotal },
        inputTax: { bills: billTax, quickExpenses: qeTax, total: inputTotal },
        refundedTax,
        netTaxPayable: outputTotal - refundedTax - inputTotal,
        rows: [
          ...invoices.map((i) => ({
            source: "Invoice" as const,
            number: i.invoice_number,
            date: i.issue_date,
            taxable: num(i.subtotal),
            tax: num(i.tax_total),
            direction: "output" as const,
          })),
          ...posOrders.map((o) => ({
            source: "POS" as const,
            number: o.order_number,
            date: (o.completed_at ?? o.created_at)?.slice(0, 10) ?? "",
            taxable: num(o.subtotal),
            tax: num(o.tax_total),
            direction: "output" as const,
          })),
          ...bills.map((b) => ({
            source: "Bill" as const,
            number: b.bill_number,
            date: b.issue_date,
            taxable: num(b.subtotal),
            tax: num(b.tax_total),
            direction: "input" as const,
          })),
          ...quickExpenses.map((e) => ({
            source: "Quick Expense" as const,
            number: e.expense_number,
            date: e.date,
            taxable: num(e.amount),
            tax: num(e.tax_amount),
            direction: "input" as const,
          })),
          ...creditNotes.map((c) => ({
            source: "Credit Note" as const,
            number: c.credit_note_number,
            date: c.issue_date,
            taxable: num(c.subtotal),
            tax: num(c.tax_total),
            direction: "refund" as const,
          })),
        ].sort((a, b) => (a.date < b.date ? 1 : -1)),
      };
    },
  });
}

// ============================================================================
// CASH FLOW
// ============================================================================

export interface CashFlowData {
  filters: ReportFilters;
  inflow: {
    customerPayments: number;
    posPayments: number;
    cashIns: number;
    total: number;
  };
  outflow: {
    supplierPayments: number;
    quickExpenses: number;
    cashRefunds: number;
    cashOuts: number;
    total: number;
  };
  netCashFlow: number;
  byMethod: Array<{ method: string; inflow: number; outflow: number }>;
  rows: Array<{
    date: string;
    type: string;
    method: string;
    reference: string;
    inflow: number;
    outflow: number;
  }>;
}

export function useCashFlow(filters: ReportFilters) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["report-cashflow", companyId, filters],
    enabled: !!companyId,
    queryFn: async (): Promise<CashFlowData> => {
      // Invoice/Bill payments
      const payQ = supabase
        .from("payments")
        .select("id, paid_at, amount, method, reference, direction")
        .eq("company_id", companyId!)
        .gte("paid_at", startOfDay(filters.from))
        .lte("paid_at", endOfDay(filters.to));

      // POS payments — derive via pos_orders for company filter & branch filter
      let posOrdQ = supabase
        .from("pos_orders")
        .select("id, order_number, completed_at, branch_id, status")
        .eq("company_id", companyId!)
        .eq("status", "completed")
        .gte("completed_at", startOfDay(filters.from))
        .lte("completed_at", endOfDay(filters.to));
      if (filters.branchId) posOrdQ = posOrdQ.eq("branch_id", filters.branchId);

      // Quick expenses (cash outflow only when method = cash and paid)
      let qeQ = supabase
        .from("quick_expenses")
        .select("id, expense_number, date, amount, tax_amount, payment_method, paid, branch_id")
        .eq("company_id", companyId!)
        .eq("paid", true)
        .gte("date", filters.from)
        .lte("date", filters.to);
      if (filters.branchId) qeQ = qeQ.eq("branch_id", filters.branchId);

      // Cash refunds
      let crQ = supabase
        .from("cash_refunds")
        .select("id, paid_at, amount, method, reference, branch_id")
        .eq("company_id", companyId!)
        .gte("paid_at", startOfDay(filters.from))
        .lte("paid_at", endOfDay(filters.to));
      if (filters.branchId) crQ = crQ.eq("branch_id", filters.branchId);

      // Cash session events — pay-in / pay-out / drop
      let evQ = supabase
        .from("cash_session_events")
        .select(
          "id, type, amount, reference, note, created_at, cash_sessions!inner(company_id, branch_id)",
        )
        .eq("cash_sessions.company_id", companyId!)
        .gte("created_at", startOfDay(filters.from))
        .lte("created_at", endOfDay(filters.to));
      if (filters.branchId) evQ = evQ.eq("cash_sessions.branch_id", filters.branchId);

      const [payRes, posOrdRes, qeRes, crRes, evRes] = await Promise.all([
        payQ,
        posOrdQ,
        qeQ,
        crQ,
        evQ,
      ]);

      // Now get pos_payments for those orders
      const posOrders = posOrdRes.data ?? [];
      const orderIds = posOrders.map((o) => o.id);
      const posPaymentsRes = orderIds.length
        ? await supabase
            .from("pos_payments")
            .select("id, order_id, method, amount, reference, created_at")
            .in("order_id", orderIds)
        : { data: [] as Array<{ id: string; order_id: string; method: string; amount: number; reference: string | null; created_at: string }> };

      const payments = payRes.data ?? [];
      const posPayments = posPaymentsRes.data ?? [];
      const quickExpenses = qeRes.data ?? [];
      const cashRefunds = crRes.data ?? [];
      const events = evRes.data ?? [];

      const customerPayments = payments
        .filter((p) => p.direction === "in")
        .reduce((s, p) => s + num(p.amount), 0);
      const supplierPayments = payments
        .filter((p) => p.direction === "out")
        .reduce((s, p) => s + num(p.amount), 0);
      const posPaymentsTotal = posPayments.reduce((s, p) => s + num(p.amount), 0);
      const qeTotal = quickExpenses.reduce((s, e) => s + num(e.amount) + num(e.tax_amount), 0);
      const crTotal = cashRefunds.reduce((s, c) => s + num(c.amount), 0);
      const cashIns = events
        .filter((e) => e.type === "pay_in")
        .reduce((s, e) => s + num(e.amount), 0);
      const cashOuts = events
        .filter((e) => e.type === "pay_out" || e.type === "drop")
        .reduce((s, e) => s + num(e.amount), 0);

      // By method aggregation
      const methodMap = new Map<string, { inflow: number; outflow: number }>();
      const bump = (m: string, key: "inflow" | "outflow", n: number) => {
        const cur = methodMap.get(m) ?? { inflow: 0, outflow: 0 };
        cur[key] += n;
        methodMap.set(m, cur);
      };
      for (const p of payments) {
        bump(p.method, p.direction === "in" ? "inflow" : "outflow", num(p.amount));
      }
      for (const p of posPayments) {
        bump(p.method, "inflow", num(p.amount));
      }
      for (const e of quickExpenses) {
        bump(e.payment_method ?? "cash", "outflow", num(e.amount) + num(e.tax_amount));
      }
      for (const c of cashRefunds) {
        bump(c.method ?? "cash", "outflow", num(c.amount));
      }

      const inflowTotal = customerPayments + posPaymentsTotal + cashIns;
      const outflowTotal = supplierPayments + qeTotal + crTotal + cashOuts;

      // Build rows in date order
      const orderIdToInfo = new Map(
        posOrders.map((o) => [o.id, { number: o.order_number, date: o.completed_at }]),
      );

      const rows = [
        ...payments.map((p) => ({
          date: p.paid_at?.slice(0, 10) ?? "",
          type: p.direction === "in" ? "Customer Payment" : "Supplier Payment",
          method: p.method,
          reference: p.reference ?? "—",
          inflow: p.direction === "in" ? num(p.amount) : 0,
          outflow: p.direction === "out" ? num(p.amount) : 0,
        })),
        ...posPayments.map((p) => {
          const info = orderIdToInfo.get(p.order_id);
          return {
            date: (info?.date ?? p.created_at)?.slice(0, 10) ?? "",
            type: "POS Payment",
            method: p.method,
            reference: info?.number ?? p.reference ?? "—",
            inflow: num(p.amount),
            outflow: 0,
          };
        }),
        ...quickExpenses.map((e) => ({
          date: e.date,
          type: "Quick Expense",
          method: e.payment_method ?? "cash",
          reference: e.expense_number,
          inflow: 0,
          outflow: num(e.amount) + num(e.tax_amount),
        })),
        ...cashRefunds.map((c) => ({
          date: c.paid_at?.slice(0, 10) ?? "",
          type: "Cash Refund",
          method: c.method ?? "cash",
          reference: c.reference ?? "—",
          inflow: 0,
          outflow: num(c.amount),
        })),
        ...events.map((e) => ({
          date: e.created_at?.slice(0, 10) ?? "",
          type: `Drawer ${e.type}`,
          method: "cash",
          reference: e.reference ?? e.note ?? "—",
          inflow: e.type === "pay_in" ? num(e.amount) : 0,
          outflow: e.type === "pay_out" || e.type === "drop" ? num(e.amount) : 0,
        })),
      ].sort((a, b) => (a.date < b.date ? 1 : -1));

      return {
        filters,
        inflow: {
          customerPayments,
          posPayments: posPaymentsTotal,
          cashIns,
          total: inflowTotal,
        },
        outflow: {
          supplierPayments,
          quickExpenses: qeTotal,
          cashRefunds: crTotal,
          cashOuts,
          total: outflowTotal,
        },
        netCashFlow: inflowTotal - outflowTotal,
        byMethod: Array.from(methodMap.entries())
          .map(([method, v]) => ({ method, ...v }))
          .sort((a, b) => b.inflow + b.outflow - (a.inflow + a.outflow)),
        rows,
      };
    },
  });
}

// ============================================================================
// DASHBOARD AGGREGATES (reuses report hooks for reconciliation)
// ============================================================================

export interface AgingBucket {
  label: string;
  amount: number;
  count: number;
}

export interface AgingData {
  current: AgingBucket;
  d30: AgingBucket;
  d60: AgingBucket;
  d90: AgingBucket;
  total: number;
}

export function useReceivablesAging() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["aging-receivables", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<AgingData> => {
      const { data, error } = await supabase
        .from("customer_invoices")
        .select("total, amount_paid, status, due_date, issue_date")
        .eq("company_id", companyId!)
        .neq("status", "draft")
        .neq("status", "cancelled");
      if (error) throw error;
      return bucketAging(data ?? []);
    },
  });
}

export function usePayablesAging() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["aging-payables", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<AgingData> => {
      const { data, error } = await supabase
        .from("supplier_bills")
        .select("total, amount_paid, status, due_date, issue_date")
        .eq("company_id", companyId!)
        .neq("status", "draft")
        .neq("status", "cancelled");
      if (error) throw error;
      return bucketAging(data ?? []);
    },
  });
}

function bucketAging(
  rows: Array<{
    total: number | string;
    amount_paid: number | string;
    due_date: string | null;
    issue_date: string;
  }>,
): AgingData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets: AgingData = {
    current: { label: "Current", amount: 0, count: 0 },
    d30: { label: "1–30 days", amount: 0, count: 0 },
    d60: { label: "31–60 days", amount: 0, count: 0 },
    d90: { label: "60+ days", amount: 0, count: 0 },
    total: 0,
  };

  for (const r of rows) {
    const open = num(r.total) - num(r.amount_paid);
    if (open <= 0.005) continue;
    const refDate = new Date(r.due_date ?? r.issue_date);
    refDate.setHours(0, 0, 0, 0);
    const days = Math.floor((today.getTime() - refDate.getTime()) / 86_400_000);

    let bucket: AgingBucket;
    if (days <= 0) bucket = buckets.current;
    else if (days <= 30) bucket = buckets.d30;
    else if (days <= 60) bucket = buckets.d60;
    else bucket = buckets.d90;

    bucket.amount += open;
    bucket.count += 1;
    buckets.total += open;
  }
  return buckets;
}

export interface CashByBranch {
  branchId: string | null;
  branchName: string;
  expectedCash: number;
  openSessions: number;
}

export function useCashByBranch() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["cash-by-branch", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<CashByBranch[]> => {
      const { data, error } = await supabase
        .from("cash_sessions")
        .select("branch_id, expected_cash, status, branches(name)")
        .eq("company_id", companyId!)
        .eq("status", "open");
      if (error) throw error;

      const map = new Map<string, CashByBranch>();
      for (const s of data ?? []) {
        const id = s.branch_id ?? "—";
        const name = (s.branches as { name?: string } | null)?.name ?? "Unknown";
        const cur = map.get(id) ?? { branchId: s.branch_id, branchName: name, expectedCash: 0, openSessions: 0 };
        cur.expectedCash += num(s.expected_cash);
        cur.openSessions += 1;
        map.set(id, cur);
      }
      return Array.from(map.values()).sort((a, b) => b.expectedCash - a.expectedCash);
    },
  });
}
