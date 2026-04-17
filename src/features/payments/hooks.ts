import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Payment {
  id: string;
  company_id: string;
  direction: "in" | "out";
  party_type: "customer" | "supplier";
  party_id: string;
  invoice_id: string | null;
  bill_id: string | null;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference: string | null;
  paid_at: string;
  notes: string | null;
}

export function usePayments() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["payments", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("company_id", companyId!)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });
}

export function usePayment(id: string | undefined) {
  return useQuery({
    queryKey: ["payment", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Payment | null;
    },
  });
}
