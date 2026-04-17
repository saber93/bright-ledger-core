import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Account {
  id: string;
  company_id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  parent_id: string | null;
  description: string | null;
  is_active: boolean;
}

export function useChartOfAccounts() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["coa", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("company_id", companyId!)
        .order("code");
      if (error) throw error;
      return data as Account[];
    },
  });
}
