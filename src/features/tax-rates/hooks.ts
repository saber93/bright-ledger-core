import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type TaxRateType = "sales" | "purchase" | "both";

export interface TaxRate {
  id: string;
  company_id: string;
  name: string;
  rate: number;
  type: TaxRateType;
  is_inclusive: boolean;
  account_id: string | null;
  is_default: boolean;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useTaxRates() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["tax-rates", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_rates")
        .select("*")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data as TaxRate[];
    },
  });
}

export function useCreateTaxRate() {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<TaxRate>) => {
      const { error } = await supabase.from("tax_rates").insert({
        company_id: companyId!,
        name: input.name!,
        rate: input.rate ?? 0,
        type: input.type ?? "both",
        is_inclusive: input.is_inclusive ?? false,
        account_id: input.account_id ?? null,
        is_default: input.is_default ?? false,
        is_active: input.is_active ?? true,
        effective_from: input.effective_from ?? new Date().toISOString().slice(0, 10),
        effective_to: input.effective_to ?? null,
        description: input.description ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-rates"] }),
  });
}

export function useUpdateTaxRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TaxRate> }) => {
      const { error } = await supabase.from("tax_rates").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-rates"] }),
  });
}

export function useDeleteTaxRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tax_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-rates"] }),
  });
}
