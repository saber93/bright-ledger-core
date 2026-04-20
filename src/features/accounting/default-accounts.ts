import { supabase } from "@/integrations/supabase/client";

export interface DefaultPostingAccounts {
  salesRevenueId: string | null;
  serviceRevenueId: string | null;
  accountsPayableId: string | null;
  defaultExpenseId: string | null;
}

export async function getDefaultPostingAccounts(
  companyId: string,
): Promise<DefaultPostingAccounts> {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id, code")
    .eq("company_id", companyId)
    .in("code", ["4100", "4200", "2100", "5500"])
    .order("code");

  if (error) throw error;

  const byCode = new Map((data ?? []).map((row) => [row.code, row.id as string]));

  return {
    salesRevenueId: byCode.get("4100") ?? null,
    serviceRevenueId: byCode.get("4200") ?? null,
    accountsPayableId: byCode.get("2100") ?? null,
    defaultExpenseId: byCode.get("5500") ?? null,
  };
}
