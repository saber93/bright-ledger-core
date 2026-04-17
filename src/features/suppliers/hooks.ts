import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  address_line1: string | null;
  city: string | null;
  country: string | null;
  currency: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export function useSuppliers() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["suppliers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: ["supplier", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Supplier | null;
    },
  });
}

export function useUpsertSupplier() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<Supplier> & { id?: string }) => {
      if (input.id) {
        const { error } = await supabase.from("suppliers").update(input).eq("id", input.id);
        if (error) throw error;
        return input.id;
      } else {
        const { data, error } = await supabase
          .from("suppliers")
          .insert({
            ...input,
            company_id: companyId!,
            created_by: user?.id,
            name: input.name!,
          })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["supplier"] });
    },
  });
}
