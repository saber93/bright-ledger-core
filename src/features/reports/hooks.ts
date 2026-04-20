/**
 * Reports aggregation layer.
 *
 * Group 5 reconciliation guardrail:
 * - core financial statements read from the validated ledger source
 *   (`public.accounting_ledger_lines`)
 * - operational analytics keep reading document/subledger tables only where
 *   the report is not itself a financial statement (sales mix, top items,
 *   aging buckets, open drawer cash)
 *
 * Filters are inclusive on both endpoints: `from <= date <= to`.
 * Branch filter applies only where the validated ledger can carry a branch.
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchLedgerLines,
  type LedgerLine,
} from "@/features/accounting/ledger";
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

function sourceLabel(sourceType: string): string {
  switch (sourceType) {
    case "customer_invoice":
      return "Invoice";
    case "pos_invoice":
      return "POS";
    case "supplier_bill":
      return "Bill";
    case "quick_expense":
      return "Quick Expense";
    case "credit_note":
      return "Credit Note";
    case "pos_cogs":
      return "POS COGS";
    case "refund_restock":
      return "Refund Restock";
    case "customer_payment":
      return "Customer Payment";
    case "supplier_payment":
      return "Supplier Payment";
    case "cash_refund":
      return "Cash Refund";
    case "cash_session_transfer":
      return "Drawer Transfer";
    default:
      return sourceType;
  }
}

function getJournalRow<T extends { amount: number }>(
  map: Map<string, T>,
  line: LedgerLine,
  create: () => T,
  amount: number,
) {
  const existing = map.get(line.journal_key);
  if (existing) {
    existing.amount += amount;
    return existing;
  }
  const next = create();
  next.amount += amount;
  map.set(line.journal_key, next);
  return next;
}

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
    cogs: number;
    restockRecoveries: number;
    total: number;
    rows: Array<{
      source: "Bill" | "Quick Expense" | "POS COGS" | "Refund Restock";
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
      const lines = await fetchLedgerLines(companyId!, filters);

      const revenueRows = new Map<
        string,
        {
          source: "Invoice" | "POS";
          number: string;
          date: string;
          counterparty: string;
          amount: number;
        }
      >();
      const expenseRows = new Map<
        string,
        {
          source: "Bill" | "Quick Expense" | "POS COGS" | "Refund Restock";
          number: string;
          date: string;
          counterparty: string;
          amount: number;
        }
      >();

      let invoiceRevenue = 0;
      let posRevenue = 0;
      let billExpense = 0;
      let quickExpense = 0;
      let cogs = 0;
      let restockRecoveries = 0;
      let refundTotal = 0;

      for (const line of lines) {
        if (line.account_type === "income") {
          if (line.source_type === "credit_note") {
            refundTotal += line.debit;
            continue;
          }

          const amount = line.credit - line.debit;
          if (amount <= 0.005) continue;

          const source = line.source_type === "pos_invoice" ? "POS" : "Invoice";
          getJournalRow(
            revenueRows,
            line,
            () => ({
              source,
              number: line.document_number,
              date: line.journal_date,
              counterparty: line.counterparty_name ?? "—",
              amount: 0,
            }),
            amount,
          );

          if (source === "POS") {
            posRevenue += amount;
          } else {
            invoiceRevenue += amount;
          }
        }

        if (line.account_type === "expense") {
          const amount = line.debit - line.credit;
          if (Math.abs(amount) <= 0.005) continue;

          const source = (
            line.source_type === "supplier_bill"
              ? "Bill"
              : line.source_type === "quick_expense"
                ? "Quick Expense"
                : line.source_type === "pos_cogs"
                  ? "POS COGS"
                  : "Refund Restock"
          ) as "Bill" | "Quick Expense" | "POS COGS" | "Refund Restock";

          getJournalRow(
            expenseRows,
            line,
            () => ({
              source,
              number: line.document_number,
              date: line.journal_date,
              counterparty: line.counterparty_name ?? "—",
              amount: 0,
            }),
            amount,
          );

          if (source === "Bill") billExpense += amount;
          if (source === "Quick Expense") quickExpense += amount;
          if (source === "POS COGS") cogs += amount;
          if (source === "Refund Restock") restockRecoveries += amount;
        }
      }

      const grossRevenue = invoiceRevenue + posRevenue;
      const netRevenue = grossRevenue - refundTotal;
      const totalExpenses = billExpense + quickExpense + cogs + restockRecoveries;

      return {
        filters,
        revenue: {
          invoices: invoiceRevenue,
          pos: posRevenue,
          total: grossRevenue,
          rows: Array.from(revenueRows.values()).sort((a, b) => (a.date < b.date ? 1 : -1)),
        },
        expenses: {
          bills: billExpense,
          quickExpenses: quickExpense,
          cogs,
          restockRecoveries,
          total: totalExpenses,
          rows: Array.from(expenseRows.values()).sort((a, b) => (a.date < b.date ? 1 : -1)),
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
      const lines = await fetchLedgerLines(companyId!, filters);
      const journals = new Map<
        string,
        {
          source: "Invoice" | "POS" | "Bill" | "Quick Expense" | "Credit Note";
          number: string;
          date: string;
          taxable: number;
          tax: number;
          direction: "output" | "input" | "refund";
        }
      >();

      let invTax = 0;
      let posTax = 0;
      let billTax = 0;
      let qeTax = 0;
      let refundedTax = 0;

      for (const line of lines) {
        if (line.source_type === "customer_invoice" || line.source_type === "pos_invoice") {
          if (line.account_type === "income") {
            const entry = journals.get(line.journal_key) ?? {
              source: line.source_type === "pos_invoice" ? "POS" : "Invoice",
              number: line.document_number,
              date: line.journal_date,
              taxable: 0,
              tax: 0,
              direction: "output" as const,
            };
            entry.taxable += line.credit - line.debit;
            journals.set(line.journal_key, entry);
          }
          if (line.account_code === "2200") {
            const entry = journals.get(line.journal_key) ?? {
              source: line.source_type === "pos_invoice" ? "POS" : "Invoice",
              number: line.document_number,
              date: line.journal_date,
              taxable: 0,
              tax: 0,
              direction: "output" as const,
            };
            entry.tax += line.credit;
            journals.set(line.journal_key, entry);
            if (line.source_type === "pos_invoice") posTax += line.credit;
            else invTax += line.credit;
          }
        }

        if (line.source_type === "supplier_bill" || line.source_type === "quick_expense") {
          if (line.account_type === "expense") {
            const entry = journals.get(line.journal_key) ?? {
              source: line.source_type === "supplier_bill" ? "Bill" : "Quick Expense",
              number: line.document_number,
              date: line.journal_date,
              taxable: 0,
              tax: 0,
              direction: "input" as const,
            };
            entry.taxable += line.debit - line.credit;
            journals.set(line.journal_key, entry);
          }
          if (line.account_code === "2200") {
            const entry = journals.get(line.journal_key) ?? {
              source: line.source_type === "supplier_bill" ? "Bill" : "Quick Expense",
              number: line.document_number,
              date: line.journal_date,
              taxable: 0,
              tax: 0,
              direction: "input" as const,
            };
            entry.tax += line.debit;
            journals.set(line.journal_key, entry);
            if (line.source_type === "supplier_bill") billTax += line.debit;
            else qeTax += line.debit;
          }
        }

        if (line.source_type === "credit_note") {
          if (line.account_type === "income") {
            const entry = journals.get(line.journal_key) ?? {
              source: "Credit Note",
              number: line.document_number,
              date: line.journal_date,
              taxable: 0,
              tax: 0,
              direction: "refund" as const,
            };
            entry.taxable += line.debit - line.credit;
            journals.set(line.journal_key, entry);
          }
          if (line.account_code === "2200") {
            const entry = journals.get(line.journal_key) ?? {
              source: "Credit Note",
              number: line.document_number,
              date: line.journal_date,
              taxable: 0,
              tax: 0,
              direction: "refund" as const,
            };
            entry.tax += line.debit;
            journals.set(line.journal_key, entry);
            refundedTax += line.debit;
          }
        }
      }

      const outputTotal = invTax + posTax;
      const inputTotal = billTax + qeTax;

      return {
        filters,
        outputTax: { invoices: invTax, pos: posTax, total: outputTotal },
        inputTax: { bills: billTax, quickExpenses: qeTax, total: inputTotal },
        refundedTax,
        netTaxPayable: outputTotal - refundedTax - inputTotal,
        rows: Array.from(journals.values())
          .filter((entry) => entry.tax > 0.005)
          .sort((a, b) => (a.date < b.date ? 1 : -1)),
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
    total: number;
  };
  outflow: {
    supplierPayments: number;
    quickExpenses: number;
    cashRefunds: number;
    total: number;
  };
  transfers: {
    cashIns: number;
    cashOuts: number;
    total: number;
  };
  netCashFlow: number;
  byMethod: Array<{
    method: string;
    inflow: number;
    outflow: number;
    transferIn: number;
    transferOut: number;
  }>;
  rows: Array<{
    date: string;
    type: string;
    method: string;
    reference: string;
    inflow: number;
    outflow: number;
    movementClass: "flow" | "transfer";
    sourceHref?: string | null;
  }>;
}

export function useCashFlow(filters: ReportFilters) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["report-cashflow", companyId, filters],
    enabled: !!companyId,
    queryFn: async (): Promise<CashFlowData> => {
      const lines = await fetchLedgerLines(companyId!, filters);

      const methodMap = new Map<
        string,
        { inflow: number; outflow: number; transferIn: number; transferOut: number }
      >();
      const rows: CashFlowData["rows"] = [];

      let customerPayments = 0;
      let supplierPayments = 0;
      let quickExpenses = 0;
      let cashRefunds = 0;
      let cashIns = 0;
      let cashOuts = 0;

      const bumpMethod = (
        method: string,
        key: "inflow" | "outflow" | "transferIn" | "transferOut",
        amount: number,
      ) => {
        const current = methodMap.get(method) ?? {
          inflow: 0,
          outflow: 0,
          transferIn: 0,
          transferOut: 0,
        };
        current[key] += amount;
        methodMap.set(method, current);
      };

      for (const line of lines) {
        const accountCode = line.account_code ?? "";
        if (!["1100", "1200"].includes(accountCode)) continue;

        if (line.source_type === "cash_session_transfer") {
          if (accountCode !== "1100") continue;

          if (line.debit > 0) {
            cashIns += line.debit;
            bumpMethod("cash_transfer", "transferIn", line.debit);
            rows.push({
              date: line.journal_date,
              type: "Drawer cash-in",
              method: "cash_transfer",
              reference: line.reference ?? line.document_number ?? "—",
              inflow: line.debit,
              outflow: 0,
              movementClass: "transfer",
              sourceHref: line.source_href,
            });
          } else if (line.credit > 0) {
            cashOuts += line.credit;
            bumpMethod("cash_transfer", "transferOut", line.credit);
            rows.push({
              date: line.journal_date,
              type: "Drawer cash-out",
              method: "cash_transfer",
              reference: line.reference ?? line.document_number ?? "—",
              inflow: 0,
              outflow: line.credit,
              movementClass: "transfer",
              sourceHref: line.source_href,
            });
          }
          continue;
        }

        const method = line.payment_method ?? "bank_transfer";
        if (line.source_type === "customer_payment" && line.debit > 0) {
          customerPayments += line.debit;
          bumpMethod(method, "inflow", line.debit);
          rows.push({
            date: line.journal_date,
            type: "Customer payment",
            method,
            reference: line.reference ?? line.document_number ?? "—",
            inflow: line.debit,
            outflow: 0,
            movementClass: "flow",
            sourceHref: line.source_href,
          });
        }

        if (line.source_type === "supplier_payment" && line.credit > 0) {
          supplierPayments += line.credit;
          bumpMethod(method, "outflow", line.credit);
          rows.push({
            date: line.journal_date,
            type: "Supplier payment",
            method,
            reference: line.reference ?? line.document_number ?? "—",
            inflow: 0,
            outflow: line.credit,
            movementClass: "flow",
            sourceHref: line.source_href,
          });
        }

        if (line.source_type === "quick_expense" && line.credit > 0) {
          quickExpenses += line.credit;
          bumpMethod(method, "outflow", line.credit);
          rows.push({
            date: line.journal_date,
            type: "Quick expense",
            method,
            reference: line.reference ?? line.document_number ?? "—",
            inflow: 0,
            outflow: line.credit,
            movementClass: "flow",
            sourceHref: line.source_href,
          });
        }

        if (line.source_type === "cash_refund" && line.credit > 0) {
          cashRefunds += line.credit;
          bumpMethod(method, "outflow", line.credit);
          rows.push({
            date: line.journal_date,
            type: "Cash refund",
            method,
            reference: line.reference ?? line.document_number ?? "—",
            inflow: 0,
            outflow: line.credit,
            movementClass: "flow",
            sourceHref: line.source_href,
          });
        }
      }

      const inflowTotal = customerPayments;
      const outflowTotal = supplierPayments + quickExpenses + cashRefunds;

      return {
        filters,
        inflow: {
          customerPayments,
          total: inflowTotal,
        },
        outflow: {
          supplierPayments,
          quickExpenses,
          cashRefunds,
          total: outflowTotal,
        },
        transfers: {
          cashIns,
          cashOuts,
          total: cashIns + cashOuts,
        },
        netCashFlow: inflowTotal - outflowTotal,
        byMethod: Array.from(methodMap.entries())
          .map(([method, values]) => ({ method, ...values }))
          .sort(
            (a, b) =>
              b.inflow +
              b.outflow +
              b.transferIn +
              b.transferOut -
              (a.inflow + a.outflow + a.transferIn + a.transferOut),
          ),
        rows: rows.sort((a, b) => (a.date < b.date ? 1 : -1)),
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

export interface TopItem {
  label: string;
  quantity: number;
  amount: number;
  lines: number;
}

export function useTopItems(filters: ReportFilters, limit = 5) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["top-items", companyId, filters, limit],
    enabled: !!companyId,
    queryFn: async (): Promise<TopItem[]> => {
      const invQ = supabase
        .from("customer_invoices")
        .select("id, status")
        .eq("company_id", companyId!)
        .gte("issue_date", filters.from)
        .lte("issue_date", filters.to);

      let posQ = supabase
        .from("pos_orders")
        .select("id, branch_id")
        .eq("company_id", companyId!)
        .eq("status", "completed")
        .gte("completed_at", startOfDay(filters.from))
        .lte("completed_at", endOfDay(filters.to));
      if (filters.branchId) posQ = posQ.eq("branch_id", filters.branchId);

      const [invRes, posRes] = await Promise.all([invQ, posQ]);
      if (invRes.error) throw invRes.error;
      if (posRes.error) throw posRes.error;

      const invoiceIds = (invRes.data ?? [])
        .filter((invoice) => invoice.status !== "draft" && invoice.status !== "cancelled")
        .map((invoice) => invoice.id);
      const posOrderIds = (posRes.data ?? []).map((order) => order.id);

      const [invoiceLinesRes, posLinesRes] = await Promise.all([
        invoiceIds.length > 0
          ? supabase
              .from("invoice_lines")
              .select("description, quantity, line_total")
              .in("invoice_id", invoiceIds)
          : Promise.resolve({
              data: [] as Array<{
                description: string;
                quantity: number | string;
                line_total: number | string;
              }>,
              error: null,
            }),
        posOrderIds.length > 0
          ? supabase
              .from("pos_order_lines")
              .select("description, quantity, line_total")
              .in("order_id", posOrderIds)
          : Promise.resolve({
              data: [] as Array<{
                description: string;
                quantity: number | string;
                line_total: number | string;
              }>,
              error: null,
            }),
      ]);

      if (invoiceLinesRes.error) throw invoiceLinesRes.error;
      if (posLinesRes.error) throw posLinesRes.error;

      const itemMap = new Map<string, TopItem>();

      const addLine = (description: string | null | undefined, quantity: unknown, amount: unknown) => {
        const label = description?.trim() || "Unnamed item";
        const current = itemMap.get(label) ?? { label, quantity: 0, amount: 0, lines: 0 };
        current.quantity += num(quantity);
        current.amount += num(amount);
        current.lines += 1;
        itemMap.set(label, current);
      };

      for (const line of invoiceLinesRes.data ?? []) {
        addLine(line.description, line.quantity, line.line_total);
      }
      for (const line of posLinesRes.data ?? []) {
        addLine(line.description, line.quantity, line.line_total);
      }

      return Array.from(itemMap.values())
        .sort((a, b) => b.amount - a.amount || b.quantity - a.quantity)
        .slice(0, limit);
    },
  });
}
