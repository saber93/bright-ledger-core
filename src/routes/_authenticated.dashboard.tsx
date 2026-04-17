import { createFileRoute, Link } from "@tanstack/react-router";
import { useDashboard } from "@/features/dashboard/hooks";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/data/PageHeader";
import { MetricCard } from "@/components/data/MetricCard";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  ArrowUpRight,
  Plus,
  FileText,
  Receipt,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { company } = useAuth();
  const { data, isLoading } = useDashboard();
  const currency = company?.currency ?? "USD";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Executive overview of your company's financial position."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/bills">
                <Receipt className="h-4 w-4" /> New Bill
              </Link>
            </Button>
            <Button asChild>
              <Link to="/invoices">
                <Plus className="h-4 w-4" /> New Invoice
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Revenue"
          value={<MoneyDisplay value={data?.totalRevenue} currency={currency} />}
          hint="All recognized invoices"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="success"
        />
        <MetricCard
          label="Expenses"
          value={<MoneyDisplay value={data?.totalExpenses} currency={currency} />}
          hint="All recorded bills"
          icon={<TrendingDown className="h-5 w-5" />}
          accent="warning"
        />
        <MetricCard
          label="Net Profit"
          value={<MoneyDisplay value={data?.netProfit} currency={currency} />}
          hint="Revenue − Expenses"
          icon={<Wallet className="h-5 w-5" />}
          accent="primary"
        />
        <MetricCard
          label="Open A/R"
          value={<MoneyDisplay value={data?.receivables} currency={currency} />}
          hint={`${data?.unpaidInvoiceCount ?? 0} unpaid invoices`}
          icon={<AlertCircle className="h-5 w-5" />}
          accent="info"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Open A/P"
          value={<MoneyDisplay value={data?.payables} currency={currency} />}
          hint={`${data?.unpaidBillCount ?? 0} unpaid bills`}
          accent="danger"
        />
        <MetricCard label="Customers" value={data?.customersCount ?? 0} hint="Active records" />
        <MetricCard
          label="Unpaid Invoices"
          value={data?.unpaidInvoiceCount ?? 0}
          hint="Awaiting payment"
        />
        <MetricCard
          label="Unpaid Bills"
          value={data?.unpaidBillCount ?? 0}
          hint="Awaiting settlement"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Recent invoices</h2>
            <Link
              to="/invoices"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y">
            {isLoading && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {!isLoading && (data?.recentInvoices.length ?? 0) === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                <FileText className="mx-auto mb-2 h-6 w-6 opacity-50" />
                No invoices yet.
              </div>
            )}
            {data?.recentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{inv.invoice_number}</p>
                  <p className="truncate font-medium">{inv.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(inv.issue_date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={inv.status} />
                  <MoneyDisplay value={inv.total} currency={currency} className="text-sm" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Recent payments</h2>
            <Link
              to="/payments"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y">
            {!isLoading && (data?.recentPayments.length ?? 0) === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No payments yet.
              </div>
            )}
            {data?.recentPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {p.direction === "in" ? "Received" : "Sent"} · {p.method.replace("_", " ")}
                  </p>
                  <p className="truncate font-medium">{p.reference ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.paid_at)}</p>
                </div>
                <MoneyDisplay
                  value={p.amount}
                  currency={currency}
                  className={p.direction === "in" ? "text-success" : ""}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
