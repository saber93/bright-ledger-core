import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDefaultPostingAccounts } from "@/features/accounting/default-accounts";
import { ensureAccountingPeriodUnlocked } from "@/features/accounting/locks";
import { useAuth } from "@/lib/auth";

export type QuickExpenseMethod =
  | "cash"
  | "bank"
  | "card"
  | "petty_cash"
  | "unpaid"
  | "other";

export interface QuickExpenseRow {
  id: string;
  company_id: string;
  expense_number: string;
  date: string;
  description: string;
  amount: number;
  tax_amount: number;
  currency: string;
  payment_method: QuickExpenseMethod;
  paid: boolean;
  account_id: string | null;
  payable_account_id: string | null;
  tax_rate_id: string | null;
  supplier_id: string | null;
  branch_id: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuickExpenseListItem extends QuickExpenseRow {
  account_name: string | null;
  account_code: string | null;
  supplier_name: string | null;
  branch_name: string | null;
}

export interface QuickExpenseFilters {
  from?: string;
  to?: string;
  account_id?: string | null;
  payment_method?: QuickExpenseMethod | null;
  paid?: "all" | "paid" | "unpaid";
  branch_id?: string | null;
}

export function useQuickExpenses(filters: QuickExpenseFilters = {}) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["quick-expenses", companyId, filters],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("quick_expenses")
        .select(
          "*, chart_of_accounts!quick_expenses_account_id_fkey(code, name), suppliers(name), branches(name)",
        )
        .eq("company_id", companyId!)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters.from) q = q.gte("date", filters.from);
      if (filters.to) q = q.lte("date", filters.to);
      if (filters.account_id) q = q.eq("account_id", filters.account_id);
      if (filters.payment_method) q = q.eq("payment_method", filters.payment_method);
      if (filters.branch_id) q = q.eq("branch_id", filters.branch_id);
      if (filters.paid === "paid") q = q.eq("paid", true);
      if (filters.paid === "unpaid") q = q.eq("paid", false);

      const { data, error } = await q;
      if (error) throw error;
      type Row = QuickExpenseRow & {
        chart_of_accounts: { code: string; name: string } | null;
        suppliers: { name: string } | null;
        branches: { name: string } | null;
      };
      return (data ?? []).map((r) => {
        const row = r as Row;
        return {
          ...row,
          account_name: row.chart_of_accounts?.name ?? null,
          account_code: row.chart_of_accounts?.code ?? null,
          supplier_name: row.suppliers?.name ?? null,
          branch_name: row.branches?.name ?? null,
        } as QuickExpenseListItem;
      });
    },
  });
}

export function useQuickExpense(id: string | undefined) {
  return useQuery({
    queryKey: ["quick-expense", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_expenses")
        .select(
          "*, account:chart_of_accounts!quick_expenses_account_id_fkey(id, code, name, type), payable:chart_of_accounts!quick_expenses_payable_account_id_fkey(id, code, name), suppliers(id, name), branches(id, name), tax_rates(id, name, rate)",
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

async function nextExpenseNumber(companyId: string) {
  const { data: settings } = await supabase
    .from("company_settings")
    .select("bill_prefix")
    .eq("company_id", companyId)
    .maybeSingle();
  const prefixSuffix = (settings?.bill_prefix ?? "BILL-").replace("BILL-", "");
  const prefix = `EXP-${prefixSuffix}`;
  const { count } = await supabase
    .from("quick_expenses")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  const n = (count ?? 0) + 1;
  return `${prefix}${String(n).padStart(5, "0")}`;
}

export interface QuickExpenseInput {
  id?: string;
  date: string;
  description: string;
  amount: number;
  tax_amount?: number;
  payment_method: QuickExpenseMethod;
  paid: boolean;
  account_id: string | null;
  payable_account_id?: string | null;
  tax_rate_id?: string | null;
  supplier_id?: string | null;
  branch_id?: string | null;
  receipt_url?: string | null;
}

export function useUpsertQuickExpense() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: QuickExpenseInput) => {
      if (!companyId) throw new Error("Missing company");
      await ensureAccountingPeriodUnlocked(companyId, input.date, "quick expense posting");
      const defaults = await getDefaultPostingAccounts(companyId);

      const payload = {
        date: input.date,
        description: input.description,
        amount: Number(input.amount) || 0,
        tax_amount: Number(input.tax_amount ?? 0),
        payment_method: input.payment_method,
        paid: input.paid,
        account_id: input.account_id,
        payable_account_id: input.paid
          ? null
          : input.payable_account_id ?? defaults.accountsPayableId ?? null,
        tax_rate_id: input.tax_rate_id ?? null,
        supplier_id: input.supplier_id ?? null,
        branch_id: input.branch_id ?? null,
        receipt_url: input.receipt_url ?? null,
      };

      if (input.id) {
        const { error } = await supabase
          .from("quick_expenses")
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      }

      const expense_number = await nextExpenseNumber(companyId);
      const insertRow = {
        ...payload,
        company_id: companyId,
        created_by: user?.id ?? null,
        expense_number,
      };
      const { data, error } = await supabase
        .from("quick_expenses")
        .insert(insertRow)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quick-expenses"] });
      qc.invalidateQueries({ queryKey: ["quick-expense"] });
    },
  });
}

export function useDeleteQuickExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quick_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quick-expenses"] }),
  });
}

export async function uploadExpenseReceipt(
  companyId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("expense-receipts")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function getReceiptSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("expense-receipts")
    .createSignedUrl(path, 60 * 60);
  const signedUrl = data?.signedUrl ?? null;
  if (!signedUrl) return null;

  try {
    const head = await fetch(signedUrl, { method: "HEAD" });
    if (head.ok) return signedUrl;
    if (![400, 405, 501].includes(head.status)) return null;

    const get = await fetch(signedUrl, { method: "GET" });
    return get.ok ? signedUrl : null;
  } catch {
    return null;
  }
}
