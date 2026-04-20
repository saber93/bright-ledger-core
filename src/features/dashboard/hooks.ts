import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface DashboardData {
  customersCount: number;
  recentInvoices: Array<{
    id: string;
    invoice_number: string;
    total: number;
    status: string;
    issue_date: string;
    customer_name: string;
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    direction: string;
    method: string;
    paid_at: string;
    reference: string | null;
  }>;
}

export function useDashboard() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["dashboard", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<DashboardData> => {
      const [customersRes, recentInvRes, recentPayRes] = await Promise.all([
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!),
        supabase
          .from("customer_invoices")
          .select("id, invoice_number, total, status, issue_date, customers!inner(name)")
          .eq("company_id", companyId!)
          .order("issue_date", { ascending: false })
          .limit(5),
        supabase
          .from("payments")
          .select("id, amount, direction, method, paid_at, reference")
          .eq("company_id", companyId!)
          .order("paid_at", { ascending: false })
          .limit(5),
      ]);

      return {
        customersCount: customersRes.count ?? 0,
        recentInvoices: (recentInvRes.data ?? []).map(
          (r: { customers: { name: string } } & { id: string; invoice_number: string; total: number; status: string; issue_date: string }) => ({
            id: r.id,
            invoice_number: r.invoice_number,
            total: r.total,
            status: r.status,
            issue_date: r.issue_date,
            customer_name: r.customers?.name ?? "Unknown",
          }),
        ),
        recentPayments: recentPayRes.data ?? [],
      };
    },
  });
}
