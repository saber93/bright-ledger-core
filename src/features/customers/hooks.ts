import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Customer {
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

export function useCustomers() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["customers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customer", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    },
  });
}

export function useUpsertCustomer() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<Customer> & { id?: string }) => {
      if (input.id) {
        const { error } = await supabase.from("customers").update(input).eq("id", input.id);
        if (error) throw error;
        return input.id;
      } else {
        const { data, error } = await supabase
          .from("customers")
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
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer"] });
    },
  });
}
