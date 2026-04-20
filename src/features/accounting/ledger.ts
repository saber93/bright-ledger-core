import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface LedgerFilters {
  from: string;
  to: string;
  branchId?: string | null;
}

export interface LedgerLine {
  company_id: string;
  branch_id: string | null;
  journal_date: string;
  posted_at: string | null;
  source_type: string;
  source_id: string;
  sort_order: number;
  document_type: string;
  document_id: string;
  document_number: string;
  journal_key: string;
  line_key: string;
  reference: string | null;
  description: string;
  payment_method: string | null;
  counterparty_type: string | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
  source_href: string | null;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  account_type: "asset" | "liability" | "equity" | "income" | "expense" | null;
  debit: number;
  credit: number;
  entry_side: "debit" | "credit";
  amount: number;
}

export interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: "asset" | "liability" | "equity" | "income" | "expense";
  opening_debit: number;
  opening_credit: number;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
}

export interface AccountBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: "asset" | "liability" | "equity" | "income" | "expense";
  balance_net: number;
  debit_balance: number;
  credit_balance: number;
}

export interface AccountLedgerRow {
  journal_date: string;
  posted_at: string | null;
  journal_key: string;
  line_key: string;
  source_type: string;
  document_type: string;
  document_id: string;
  document_number: string;
  reference: string | null;
  description: string;
  payment_method: string | null;
  counterparty_name: string | null;
  source_href: string | null;
  debit: number;
  credit: number;
  opening_balance: number;
  running_balance: number;
}

export interface SourceTraceFilters {
  sourceHrefs?: string[];
  documentType?: string | null;
  documentIds?: string[];
}

export interface PostingAuditJournal {
  journalKey: string;
  journalDate: string;
  postedAt: string | null;
  sourceType: string;
  documentType: string;
  documentId: string;
  documentNumber: string;
  paymentMethod: string | null;
  sourceHref: string | null;
  debitTotal: number;
  creditTotal: number;
  difference: number;
  balanced: boolean;
  lines: LedgerLine[];
}

export interface PostingAuditResult {
  lines: LedgerLine[];
  journals: PostingAuditJournal[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
  balanced: boolean;
  fallbackLines: LedgerLine[];
}

type SupabaseRowsResult = PromiseLike<{
  data: Record<string, unknown>[] | null;
  error: Error | null;
}>;

interface LedgerSelectQuery extends SupabaseRowsResult {
  select(columns: string): LedgerSelectQuery;
  eq(column: string, value: string): LedgerSelectQuery;
  gte(column: string, value: string): LedgerSelectQuery;
  lte(column: string, value: string): LedgerSelectQuery;
  order(column: string, options?: { ascending?: boolean }): LedgerSelectQuery;
}

const supabaseUntyped = supabase as unknown as {
  from: (relation: string) => LedgerSelectQuery;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown[] | null; error: Error | null }>;
};

const num = (value: unknown): number => {
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

function mapLedgerLine(row: Record<string, unknown>): LedgerLine {
  return {
    company_id: String(row.company_id),
    branch_id: row.branch_id ? String(row.branch_id) : null,
    journal_date: String(row.journal_date),
    posted_at: row.posted_at ? String(row.posted_at) : null,
    source_type: String(row.source_type),
    source_id: String(row.source_id),
    sort_order: num(row.sort_order),
    document_type: String(row.document_type),
    document_id: String(row.document_id),
    document_number: String(row.document_number ?? ""),
    journal_key: String(row.journal_key),
    line_key: String(row.line_key),
    reference: row.reference ? String(row.reference) : null,
    description: String(row.description ?? ""),
    payment_method: row.payment_method ? String(row.payment_method) : null,
    counterparty_type: row.counterparty_type ? String(row.counterparty_type) : null,
    counterparty_id: row.counterparty_id ? String(row.counterparty_id) : null,
    counterparty_name: row.counterparty_name ? String(row.counterparty_name) : null,
    source_href: row.source_href ? String(row.source_href) : null,
    account_id: String(row.account_id),
    account_code: row.account_code ? String(row.account_code) : null,
    account_name: row.account_name ? String(row.account_name) : null,
    account_type: (row.account_type as LedgerLine["account_type"]) ?? null,
    debit: num(row.debit),
    credit: num(row.credit),
    entry_side: (row.entry_side as "debit" | "credit") ?? "debit",
    amount: num(row.amount),
  };
}

function mapTrialBalanceRow(row: Record<string, unknown>): TrialBalanceRow {
  return {
    account_id: String(row.account_id),
    account_code: String(row.account_code ?? ""),
    account_name: String(row.account_name ?? ""),
    account_type: row.account_type as TrialBalanceRow["account_type"],
    opening_debit: num(row.opening_debit),
    opening_credit: num(row.opening_credit),
    period_debit: num(row.period_debit),
    period_credit: num(row.period_credit),
    closing_debit: num(row.closing_debit),
    closing_credit: num(row.closing_credit),
  };
}

function mapAccountBalanceRow(row: Record<string, unknown>): AccountBalanceRow {
  return {
    account_id: String(row.account_id),
    account_code: String(row.account_code ?? ""),
    account_name: String(row.account_name ?? ""),
    account_type: row.account_type as AccountBalanceRow["account_type"],
    balance_net: num(row.balance_net),
    debit_balance: num(row.debit_balance),
    credit_balance: num(row.credit_balance),
  };
}

function mapAccountLedgerRow(row: Record<string, unknown>): AccountLedgerRow {
  return {
    journal_date: String(row.journal_date),
    posted_at: row.posted_at ? String(row.posted_at) : null,
    journal_key: String(row.journal_key),
    line_key: String(row.line_key),
    source_type: String(row.source_type),
    document_type: String(row.document_type),
    document_id: String(row.document_id),
    document_number: String(row.document_number ?? ""),
    reference: row.reference ? String(row.reference) : null,
    description: String(row.description ?? ""),
    payment_method: row.payment_method ? String(row.payment_method) : null,
    counterparty_name: row.counterparty_name ? String(row.counterparty_name) : null,
    source_href: row.source_href ? String(row.source_href) : null,
    debit: num(row.debit),
    credit: num(row.credit),
    opening_balance: num(row.opening_balance),
    running_balance: num(row.running_balance),
  };
}

export async function fetchLedgerLines(
  companyId: string,
  filters: LedgerFilters,
): Promise<LedgerLine[]> {
  let query = supabaseUntyped
    .from("accounting_ledger_lines")
    .select("*")
    .eq("company_id", companyId)
    .gte("journal_date", filters.from)
    .lte("journal_date", filters.to)
    .order("journal_date", { ascending: true })
    .order("posted_at", { ascending: true })
    .order("journal_key", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("line_key", { ascending: true });

  if (filters.branchId) {
    query = query.eq("branch_id", filters.branchId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => mapLedgerLine(row));
}

export async function fetchTrialBalance(
  companyId: string,
  filters: LedgerFilters,
): Promise<TrialBalanceRow[]> {
  const { data, error } = await supabaseUntyped.rpc("accounting_trial_balance", {
    _company_id: companyId,
    _from: filters.from,
    _to: filters.to,
    _branch_id: filters.branchId ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => mapTrialBalanceRow(row));
}

export async function fetchAccountBalances(
  companyId: string,
  asOf: string,
  branchId?: string | null,
): Promise<AccountBalanceRow[]> {
  const { data, error } = await supabaseUntyped.rpc("accounting_account_balances", {
    _company_id: companyId,
    _as_of: asOf,
    _branch_id: branchId ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => mapAccountBalanceRow(row));
}

export async function fetchAccountLedger(
  companyId: string,
  accountId: string,
  filters: LedgerFilters,
): Promise<AccountLedgerRow[]> {
  const { data, error } = await supabaseUntyped.rpc("accounting_account_ledger", {
    _company_id: companyId,
    _account_id: accountId,
    _from: filters.from,
    _to: filters.to,
    _branch_id: filters.branchId ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => mapAccountLedgerRow(row));
}

export async function fetchSourceTrace(
  companyId: string,
  filters: SourceTraceFilters,
): Promise<LedgerLine[]> {
  const sourceHrefs = (filters.sourceHrefs ?? []).filter(Boolean);
  const documentIds = (filters.documentIds ?? []).filter(Boolean);

  if (sourceHrefs.length === 0 && (!filters.documentType || documentIds.length === 0)) {
    return [];
  }

  const { data, error } = await supabaseUntyped.rpc("accounting_source_trace", {
    _company_id: companyId,
    _source_hrefs: sourceHrefs.length > 0 ? sourceHrefs : null,
    _document_type: filters.documentType ?? null,
    _document_ids: documentIds.length > 0 ? documentIds : null,
  });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => mapLedgerLine(row));
}

export function buildPostingAudit(lines: LedgerLine[]): PostingAuditResult {
  const journals = new Map<string, PostingAuditJournal>();

  for (const line of lines) {
    const existing = journals.get(line.journal_key);
    if (existing) {
      existing.lines.push(line);
      existing.debitTotal = round(existing.debitTotal + line.debit);
      existing.creditTotal = round(existing.creditTotal + line.credit);
      existing.difference = round(existing.debitTotal - existing.creditTotal);
      existing.balanced = Math.abs(existing.difference) <= 0.01;
      continue;
    }

    journals.set(line.journal_key, {
      journalKey: line.journal_key,
      journalDate: line.journal_date,
      postedAt: line.posted_at,
      sourceType: line.source_type,
      documentType: line.document_type,
      documentId: line.document_id,
      documentNumber: line.document_number,
      paymentMethod: line.payment_method,
      sourceHref: line.source_href,
      debitTotal: round(line.debit),
      creditTotal: round(line.credit),
      difference: round(line.debit - line.credit),
      balanced: Math.abs(round(line.debit - line.credit)) <= 0.01,
      lines: [line],
    });
  }

  const totalDebit = round(lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = round(lines.reduce((sum, line) => sum + line.credit, 0));
  const difference = round(totalDebit - totalCredit);
  const fallbackLines = lines.filter((line) => {
    const lowerDescription = line.description.toLowerCase();
    return line.line_key.includes("adjustment") || lowerDescription.includes("fallback");
  });

  return {
    lines,
    journals: Array.from(journals.values()),
    totalDebit,
    totalCredit,
    difference,
    balanced: Math.abs(difference) <= 0.01,
    fallbackLines,
  };
}

export function useLedgerLines(filters: LedgerFilters) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["ledger-lines", companyId, filters],
    enabled: !!companyId,
    queryFn: () => fetchLedgerLines(companyId!, filters),
  });
}

export function useTrialBalance(filters: LedgerFilters) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["trial-balance", companyId, filters],
    enabled: !!companyId,
    queryFn: () => fetchTrialBalance(companyId!, filters),
  });
}

export function useAccountBalances(asOf: string, branchId?: string | null) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["account-balances", companyId, asOf, branchId ?? null],
    enabled: !!companyId,
    queryFn: () => fetchAccountBalances(companyId!, asOf, branchId),
  });
}

export function useAccountLedger(accountId: string | undefined, filters: LedgerFilters) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["account-ledger", companyId, accountId, filters],
    enabled: !!companyId && !!accountId,
    queryFn: () => fetchAccountLedger(companyId!, accountId!, filters),
  });
}

export function usePostingAudit(filters: SourceTraceFilters) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["posting-audit", companyId, filters],
    enabled:
      !!companyId &&
      ((filters.sourceHrefs?.filter(Boolean).length ?? 0) > 0 ||
        (!!filters.documentType && (filters.documentIds?.filter(Boolean).length ?? 0) > 0)),
    queryFn: async () => buildPostingAudit(await fetchSourceTrace(companyId!, filters)),
  });
}

export function accountTypeLabel(type: TrialBalanceRow["account_type"] | AccountBalanceRow["account_type"]) {
  switch (type) {
    case "asset":
      return "Assets";
    case "liability":
      return "Liabilities";
    case "equity":
      return "Equity";
    case "income":
      return "Income";
    case "expense":
      return "Expenses";
    default:
      return "Other";
  }
}
