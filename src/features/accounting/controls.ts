import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface AccountingPeriodRow {
  id: string | null;
  period_start: string;
  period_end: string;
  status: "open" | "closed";
  close_reason: string | null;
  closed_at: string | null;
  closed_by: string | null;
  reopen_reason: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  label: string;
}

export interface FinanceIntegrityWarning {
  severity: "warning" | "danger";
  kind: string;
  source_type: string;
  source_id: string;
  document_number: string | null;
  source_href: string | null;
  journal_date: string | null;
  message: string;
}

export interface FinanceAuditEntry {
  id: string;
  created_at: string;
  action: string;
  table_name: string;
  entity_type: string | null;
  entity_number: string | null;
  summary: string | null;
  actor_id: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown> | null;
}

export interface FinanceCloseChecklist {
  as_of: string;
  period_start: string;
  period_end: string;
  receivables: { count: number; amount: number };
  payables: { count: number; amount: number };
  open_cash_sessions: { count: number; expected_cash: number };
  recent_credits: {
    count: number;
    total: number;
    items: Array<{
      id: string;
      credit_note_number: string;
      issue_date: string;
      total: number;
      status: string;
    }>;
  };
  exceptions: { count: number; warnings: FinanceIntegrityWarning[] };
}

type UntypedError = { message?: string; details?: string } | null;

interface UntypedSelectQuery
  extends PromiseLike<{ data: Record<string, unknown>[] | null; error: UntypedError }> {
  select(columns: string): UntypedSelectQuery;
  eq(column: string, value: string): UntypedSelectQuery;
  neq(column: string, value: string): UntypedSelectQuery;
  gte(column: string, value: string): UntypedSelectQuery;
  lte(column: string, value: string): UntypedSelectQuery;
  order(column: string, options?: { ascending?: boolean }): UntypedSelectQuery;
  limit(count: number): UntypedSelectQuery;
}

const supabaseUntyped = supabase as unknown as {
  from: (relation: string) => UntypedSelectQuery;
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown[] | Record<string, unknown> | null; error: UntypedError }>;
};

const num = (value: unknown) => {
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const throwIfError = (error: UntypedError, fallback: string) => {
  if (!error) return;
  const parts = [error.message?.trim(), error.details?.trim()].filter(Boolean);
  throw new Error(parts.join(" ") || fallback);
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const monthBounds = (asOf: string) => {
  const [year, month] = asOf.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    period_start: formatDateInput(start),
    period_end: formatDateInput(end),
  };
};

function invalidateFinanceQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["accounting-periods"] });
  qc.invalidateQueries({ queryKey: ["accounting-period-state"] });
  qc.invalidateQueries({ queryKey: ["finance-exceptions"] });
  qc.invalidateQueries({ queryKey: ["finance-audit"] });
  qc.invalidateQueries({ queryKey: ["close-checklist"] });
  qc.invalidateQueries({ queryKey: ["posting-audit"] });
  qc.invalidateQueries({ queryKey: ["trial-balance"] });
  qc.invalidateQueries({ queryKey: ["account-balances"] });
  qc.invalidateQueries({ queryKey: ["account-ledger"] });
  qc.invalidateQueries({ queryKey: ["report-profit-loss"] });
  qc.invalidateQueries({ queryKey: ["report-sales"] });
  qc.invalidateQueries({ queryKey: ["report-tax"] });
  qc.invalidateQueries({ queryKey: ["report-cashflow"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["invoices"] });
  qc.invalidateQueries({ queryKey: ["invoice"] });
  qc.invalidateQueries({ queryKey: ["bills"] });
  qc.invalidateQueries({ queryKey: ["bill"] });
  qc.invalidateQueries({ queryKey: ["credit-notes"] });
  qc.invalidateQueries({ queryKey: ["credit-note"] });
  qc.invalidateQueries({ queryKey: ["payments"] });
  qc.invalidateQueries({ queryKey: ["payment"] });
  qc.invalidateQueries({ queryKey: ["quick-expenses"] });
  qc.invalidateQueries({ queryKey: ["quick-expense"] });
  qc.invalidateQueries({ queryKey: ["cash-sessions"] });
  qc.invalidateQueries({ queryKey: ["cash-session"] });
  qc.invalidateQueries({ queryKey: ["refunds-by-invoice"] });
  qc.invalidateQueries({ queryKey: ["refunds-by-pos-order"] });
}

export function useAccountingPeriods(monthsBack = 11, monthsForward = 1) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["accounting-periods", companyId, monthsBack, monthsForward],
    enabled: !!companyId,
    queryFn: async (): Promise<AccountingPeriodRow[]> => {
      const { data, error } = await supabaseUntyped.rpc("accounting_list_periods", {
        _company_id: companyId!,
        _months_back: monthsBack,
        _months_forward: monthsForward,
      });
      throwIfError(error, "Failed to load accounting periods");
      const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: row.id ? String(row.id) : null,
        period_start: String(row.period_start),
        period_end: String(row.period_end),
        status: row.status === "closed" ? "closed" : "open",
        close_reason: row.close_reason ? String(row.close_reason) : null,
        closed_at: row.closed_at ? String(row.closed_at) : null,
        closed_by: row.closed_by ? String(row.closed_by) : null,
        reopen_reason: row.reopen_reason ? String(row.reopen_reason) : null,
        reopened_at: row.reopened_at ? String(row.reopened_at) : null,
        reopened_by: row.reopened_by ? String(row.reopened_by) : null,
        label: String(row.label ?? ""),
      }));
    },
  });
}

export function useAccountingPeriodState(effectiveDate: string | undefined) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["accounting-period-state", companyId, effectiveDate],
    enabled: !!companyId && !!effectiveDate,
    queryFn: async () => {
      const { data, error } = await supabaseUntyped.rpc("accounting_period_state", {
        _company_id: companyId!,
        _effective_date: effectiveDate!,
      });
      throwIfError(error, "Failed to load accounting period state");
      const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
      if (!row) return null;
      return {
        period_start: String(row.period_start),
        period_end: String(row.period_end),
        status: row.status === "closed" ? "closed" : "open",
        reason: row.reason ? String(row.reason) : null,
        is_locked: Boolean(row.is_locked),
        label: String(row.label ?? ""),
      };
    },
  });
}

export function useFinanceExceptions() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["finance-exceptions", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<FinanceIntegrityWarning[]> => {
      const { data, error } = await supabaseUntyped.rpc("finance_integrity_warnings", {
        _company_id: companyId!,
      });
      throwIfError(error, "Failed to load finance exceptions");
      const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        severity: row.severity === "warning" ? "warning" : "danger",
        kind: String(row.kind ?? ""),
        source_type: String(row.source_type ?? ""),
        source_id: String(row.source_id ?? ""),
        document_number: row.document_number ? String(row.document_number) : null,
        source_href: row.source_href ? String(row.source_href) : null,
        journal_date: row.journal_date ? String(row.journal_date) : null,
        message: String(row.message ?? ""),
      }));
    },
  });
}

export function useFinanceAudit(limit = 80) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["finance-audit", companyId, limit],
    enabled: !!companyId,
    queryFn: async (): Promise<FinanceAuditEntry[]> => {
      const { data, error } = await supabaseUntyped
        .from("audit_logs")
        .select("id, created_at, action, table_name, entity_type, entity_number, summary, actor_id, metadata")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      throwIfError(error, "Failed to load finance audit history");

      const logs = (data ?? []) as Array<Record<string, unknown>>;
      const actorIds = Array.from(
        new Set(
          logs
            .map((row) => (row.actor_id ? String(row.actor_id) : null))
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const { data: profiles } =
        actorIds.length > 0
          ? await supabase
              .from("profiles")
              .select("user_id, display_name")
              .in("user_id", actorIds)
          : { data: [] };

      const profileById = new Map(
        (profiles ?? []).map((profile) => [profile.user_id, profile.display_name ?? null]),
      );

      return logs.map((row) => ({
        id: String(row.id),
        created_at: String(row.created_at),
        action: String(row.action ?? ""),
        table_name: String(row.table_name ?? ""),
        entity_type: row.entity_type ? String(row.entity_type) : null,
        entity_number: row.entity_number ? String(row.entity_number) : null,
        summary: row.summary ? String(row.summary) : null,
        actor_id: row.actor_id ? String(row.actor_id) : null,
        actor_name: row.actor_id ? (profileById.get(String(row.actor_id)) ?? null) : null,
        metadata:
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : null,
      }));
    },
  });
}

export function useCloseChecklist(asOfDate: string) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["close-checklist", companyId, asOfDate],
    enabled: !!companyId && !!asOfDate,
    queryFn: async (): Promise<FinanceCloseChecklist> => {
      const { period_start, period_end } = monthBounds(asOfDate);

      const [receivablesRes, payablesRes, sessionsRes, creditsRes, warningsRes] = await Promise.all([
        supabase
          .from("customer_invoices")
          .select("total, amount_paid")
          .eq("company_id", companyId!)
          .neq("status", "draft")
          .neq("status", "cancelled")
          .lte("issue_date", period_end),
        supabase
          .from("supplier_bills")
          .select("total, amount_paid")
          .eq("company_id", companyId!)
          .neq("status", "draft")
          .neq("status", "cancelled")
          .lte("issue_date", period_end),
        supabase
          .from("cash_sessions")
          .select("id, expected_cash")
          .eq("company_id", companyId!)
          .eq("status", "open"),
        supabase
          .from("credit_notes")
          .select("id, credit_note_number, issue_date, total, status")
          .eq("company_id", companyId!)
          .gte("issue_date", period_start)
          .lte("issue_date", period_end)
          .neq("status", "draft")
          .order("issue_date", { ascending: false })
          .limit(10),
        supabaseUntyped.rpc("finance_integrity_warnings", { _company_id: companyId! }),
      ]);

      if (receivablesRes.error) throw receivablesRes.error;
      if (payablesRes.error) throw payablesRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      if (creditsRes.error) throw creditsRes.error;
      throwIfError(warningsRes.error, "Failed to load finance exceptions");

      const receivables = (receivablesRes.data ?? []).reduce(
        (acc, row) => {
          const openAmount = Math.max(0, num(row.total) - num(row.amount_paid));
          if (openAmount <= 0.005) return acc;
          acc.count += 1;
          acc.amount += openAmount;
          return acc;
        },
        { count: 0, amount: 0 },
      );

      const payables = (payablesRes.data ?? []).reduce(
        (acc, row) => {
          const openAmount = Math.max(0, num(row.total) - num(row.amount_paid));
          if (openAmount <= 0.005) return acc;
          acc.count += 1;
          acc.amount += openAmount;
          return acc;
        },
        { count: 0, amount: 0 },
      );

      const open_cash_sessions = {
        count: sessionsRes.data?.length ?? 0,
        expected_cash: (sessionsRes.data ?? []).reduce(
          (sum, session) => sum + num(session.expected_cash),
          0,
        ),
      };

      const recent_credits = {
        count: creditsRes.data?.length ?? 0,
        total: (creditsRes.data ?? []).reduce((sum, row) => sum + num(row.total), 0),
        items: (creditsRes.data ?? []).map((row) => ({
          id: String(row.id),
          credit_note_number: String(row.credit_note_number ?? ""),
          issue_date: String(row.issue_date),
          total: num(row.total),
          status: String(row.status ?? ""),
        })),
      };

      const warningRows = (Array.isArray(warningsRes.data) ? warningsRes.data : []) as Array<
        Record<string, unknown>
      >;
      const warnings = warningRows.map((warning) => ({
        severity: warning.severity === "warning" ? "warning" : "danger",
        kind: String(warning.kind ?? ""),
        source_type: String(warning.source_type ?? ""),
        source_id: String(warning.source_id ?? ""),
        document_number: warning.document_number ? String(warning.document_number) : null,
        source_href: warning.source_href ? String(warning.source_href) : null,
        journal_date: warning.journal_date ? String(warning.journal_date) : null,
        message: String(warning.message ?? ""),
      })) as FinanceIntegrityWarning[];

      return {
        as_of: asOfDate,
        period_start,
        period_end,
        receivables,
        payables,
        open_cash_sessions,
        recent_credits,
        exceptions: {
          count: warnings.length,
          warnings,
        },
      };
    },
  });
}

export function useCloseAccountingPeriod() {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (input: { periodStart: string; reason?: string | null }) => {
      if (!companyId) throw new Error("Missing company");
      const { data, error } = await supabaseUntyped.rpc("accounting_close_period", {
        _company_id: companyId,
        _period_start: input.periodStart,
        _reason: input.reason ?? null,
      });
      throwIfError(error, "Failed to close accounting period");
      return data;
    },
    onSuccess: () => invalidateFinanceQueries(qc),
  });
}

export function useReopenAccountingPeriod() {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (input: { periodStart: string; reason?: string | null }) => {
      if (!companyId) throw new Error("Missing company");
      const { data, error } = await supabaseUntyped.rpc("accounting_reopen_period", {
        _company_id: companyId,
        _period_start: input.periodStart,
        _reason: input.reason ?? null,
      });
      throwIfError(error, "Failed to reopen accounting period");
      return data;
    },
    onSuccess: () => invalidateFinanceQueries(qc),
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { invoiceId: string; reason: string }) => {
      const { data, error } = await supabaseUntyped.rpc("accounting_void_invoice", {
        _invoice_id: input.invoiceId,
        _reason: input.reason,
      });
      throwIfError(error, "Failed to void invoice");
      return data;
    },
    onSuccess: () => invalidateFinanceQueries(qc),
  });
}

export function useVoidBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { billId: string; reason: string }) => {
      const { data, error } = await supabaseUntyped.rpc("accounting_void_bill", {
        _bill_id: input.billId,
        _reason: input.reason,
      });
      throwIfError(error, "Failed to void bill");
      return data;
    },
    onSuccess: () => invalidateFinanceQueries(qc),
  });
}

export function useReversePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { paymentId: string; reason: string }) => {
      const { data, error } = await supabaseUntyped.rpc("accounting_reverse_payment", {
        _payment_id: input.paymentId,
        _reason: input.reason,
      });
      throwIfError(error, "Failed to reverse payment");
      return data;
    },
    onSuccess: () => invalidateFinanceQueries(qc),
  });
}

export function useVoidCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { creditNoteId: string; reason: string }) => {
      const { data, error } = await supabaseUntyped.rpc("accounting_void_credit_note", {
        _credit_note_id: input.creditNoteId,
        _reason: input.reason,
      });
      throwIfError(error, "Failed to void credit note");
      return data;
    },
    onSuccess: () => invalidateFinanceQueries(qc),
  });
}
