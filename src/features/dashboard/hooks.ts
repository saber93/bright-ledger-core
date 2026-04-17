import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface DashboardData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  receivables: number;
  payables: number;
  unpaidInvoiceCount: number;
  unpaidBillCount: number;
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
      const [invoicesRes, billsRes, paymentsRes, customersRes, recentInvRes, recentPayRes] =
        await Promise.all([
          supabase
            .from("customer_invoices")
            .select("total, amount_paid, status")
            .eq("company_id", companyId!),
          supabase
            .from("supplier_bills")
            .select("total, amount_paid, status")
            .eq("company_id", companyId!),
          supabase.from("payments").select("amount, direction").eq("company_id", companyId!),
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

      const invoices = invoicesRes.data ?? [];
      const bills = billsRes.data ?? [];

      const totalRevenue = invoices
        .filter((i) => i.status !== "cancelled" && i.status !== "draft")
        .reduce((s, i) => s + Number(i.total), 0);

      const totalExpenses = bills
        .filter((b) => b.status !== "cancelled" && b.status !== "draft")
        .reduce((s, b) => s + Number(b.total), 0);

      const receivables = invoices.reduce(
        (s, i) => s + (Number(i.total) - Number(i.amount_paid)),
        0,
      );

      const payables = bills.reduce(
        (s, b) => s + (Number(b.total) - Number(b.amount_paid)),
        0,
      );

      const unpaidInvoiceCount = invoices.filter(
        (i) => Number(i.amount_paid) < Number(i.total) && i.status !== "cancelled" && i.status !== "draft",
      ).length;
      const unpaidBillCount = bills.filter(
        (b) => Number(b.amount_paid) < Number(b.total) && b.status !== "cancelled" && b.status !== "draft",
      ).length;

      return {
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        receivables,
        payables,
        unpaidInvoiceCount,
        unpaidBillCount,
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
