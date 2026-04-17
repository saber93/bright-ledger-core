import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Branch {
  id: string;
  company_id: string;
  name: string;
  code: string;
  address_line1: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface PosRegister {
  id: string;
  company_id: string;
  branch_id: string;
  name: string;
  code: string;
  default_warehouse_id: string | null;
  is_active: boolean;
}

export function useBranches() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["branches", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<Branch>) => {
      const { error } = await supabase.from("branches").insert({
        company_id: companyId!,
        name: input.name!,
        code: input.code!,
        address_line1: input.address_line1 ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        phone: input.phone ?? null,
        is_active: input.is_active ?? true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Branch> }) => {
      const { error } = await supabase.from("branches").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });
}

export function useRegisters() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["pos-registers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pos_registers")
        .select("*")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data as PosRegister[];
    },
  });
}

export function useCreateRegister() {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<PosRegister>) => {
      const { error } = await supabase.from("pos_registers").insert({
        company_id: companyId!,
        branch_id: input.branch_id!,
        name: input.name!,
        code: input.code!,
        default_warehouse_id: input.default_warehouse_id ?? null,
        is_active: input.is_active ?? true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-registers"] }),
  });
}

export function useUpdateRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PosRegister> }) => {
      const { error } = await supabase.from("pos_registers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-registers"] }),
  });
}

export function useDeleteRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pos_registers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-registers"] }),
  });
}
