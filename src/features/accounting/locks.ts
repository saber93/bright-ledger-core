import { supabase } from "@/integrations/supabase/client";

export interface AccountingLockState {
  accounting_lock_date: string | null;
  accounting_lock_reason: string | null;
}

export interface AccountingPeriodState {
  period_start: string;
  period_end: string;
  status: "open" | "closed";
  reason: string | null;
  is_locked: boolean;
  label: string;
}

const supabaseUntyped = supabase as unknown as {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{
    data: Record<string, unknown>[] | Record<string, unknown> | null;
    error: { message?: string; details?: string } | null;
  }>;
};

export function isDateLocked(
  accountingLockDate: string | null | undefined,
  effectiveDate: string | null | undefined,
) {
  return !!accountingLockDate && !!effectiveDate && effectiveDate <= accountingLockDate;
}

export async function fetchAccountingLockState(
  companyId: string,
): Promise<AccountingLockState> {
  const { data, error } = await supabase
    .from("company_settings")
    .select("accounting_lock_date, accounting_lock_reason")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return {
    accounting_lock_date: data?.accounting_lock_date ?? null,
    accounting_lock_reason: data?.accounting_lock_reason ?? null,
  };
}

export async function ensureAccountingPeriodUnlocked(
  companyId: string,
  effectiveDate: string,
  context: string,
) {
  const { error } = await supabaseUntyped.rpc("accounting_assert_period_unlocked", {
    _company_id: companyId,
    _effective_date: effectiveDate,
    _context: context,
  });
  if (error) {
    const parts = [error.message?.trim(), error.details?.trim()].filter(Boolean);
    throw new Error(parts.join(" "));
  }
}

export async function fetchAccountingPeriodState(
  companyId: string,
  effectiveDate: string,
): Promise<AccountingPeriodState | null> {
  const { data, error } = await supabaseUntyped.rpc("accounting_period_state", {
    _company_id: companyId,
    _effective_date: effectiveDate,
  });
  if (error) throw new Error(error.message ?? "Failed to load accounting period state");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    period_start: String(row.period_start),
    period_end: String(row.period_end),
    status: row.status === "closed" ? "closed" : "open",
    reason: row.reason ? String(row.reason) : null,
    is_locked: Boolean(row.is_locked),
    label: String(row.label ?? ""),
  };
}
