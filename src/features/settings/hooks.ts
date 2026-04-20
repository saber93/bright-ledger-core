import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface CompanySettings {
  id: string;
  company_id: string;
  accounting_enabled: boolean;
  accounting_lock_date: string | null;
  accounting_lock_reason: string | null;
  inventory_enabled: boolean;
  stock_tracking_enabled: boolean;
  online_store_enabled: boolean;
  online_payments_enabled: boolean;
  pos_enabled: boolean;
  quick_expenses_enabled: boolean;
  cash_sessions_enabled: boolean;
  tax_reporting_enabled: boolean;
  refunds_enabled: boolean;
  pos_allow_price_override: boolean;
  invoice_prefix: string;
  bill_prefix: string;
}

export function useCompanySettings() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["company-settings", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data as CompanySettings | null;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<CompanySettings>) => {
      const { error } = await supabase
        .from("company_settings")
        .update(patch)
        .eq("company_id", companyId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-settings"] }),
  });
}

export function useCompany() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCompanyMembers() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["company-members", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("id, user_id, is_active, joined_at")
        .eq("company_id", companyId!);
      if (error) throw error;

      const ids = (data ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];

      const [{ data: roles }, { data: profiles }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("company_id", companyId!)
          .in("user_id", ids),
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids),
      ]);

      return (data ?? []).map((m) => ({
        ...m,
        roles: (roles ?? []).filter((r) => r.user_id === m.user_id).map((r) => r.role as string),
        display_name:
          (profiles ?? []).find((p) => p.user_id === m.user_id)?.display_name ?? "User",
        avatar_url: (profiles ?? []).find((p) => p.user_id === m.user_id)?.avatar_url ?? null,
      }));
    },
  });
}
