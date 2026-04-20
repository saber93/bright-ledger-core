import { createFileRoute, Link } from "@tanstack/react-router";
import { defaultFilters } from "@/components/reports/ReportFilterBar";
import { MetricCard } from "@/components/data/MetricCard";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { PageHeader } from "@/components/data/PageHeader";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDashboard } from "@/features/dashboard/hooks";
import {
  type AgingData,
  useCashByBranch,
  useCashFlow,
  usePayablesAging,
  useProfitLoss,
  useReceivablesAging,
  useSalesPerformance,
  useTopItems,
} from "@/features/reports/hooks";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  BarChart3,
  FileText,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function agingCount(data: AgingData | undefined) {
  if (!data) return 0;
  return data.current.count + data.d30.count + data.d60.count + data.d90.count;
}

function AgingSection({
  title,
  data,
  isLoading,
  currency,
  href,
  ctaLabel,
}: {
  title: string;
  data: AgingData | undefined;
  isLoading: boolean;
  currency: string;
  href: string;
  ctaLabel: string;
}) {
  const rows = data
    ? [data.current, data.d30, data.d60, data.d90]
    : [
        { label: "Current", amount: 0, count: 0 },
        { label: "1–30 days", amount: 0, count: 0 },
        { label: "31–60 days", amount: 0, count: 0 },
        { label: "60+ days", amount: 0, count: 0 },
      ];

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link
          to={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {ctaLabel} <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bucket</TableHead>
            <TableHead className="text-right">Open docs</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            rows.map((bucket) => (
              <TableRow key={bucket.label}>
                <TableCell>{bucket.label}</TableCell>
                <TableCell className="text-right">{bucket.count}</TableCell>
                <TableCell className="text-right">
                  <MoneyDisplay value={bucket.amount} currency={currency} />
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold">Total open balance</TableCell>
            <TableCell className="text-right">{agingCount(data)}</TableCell>
            <TableCell className="text-right">
              <MoneyDisplay value={data?.total ?? 0} currency={currency} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </section>
  );
}

function DashboardPage() {
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";
  const filters = defaultFilters();

  const activity = useDashboard();
  const profitLoss = useProfitLoss(filters);
  const cashFlow = useCashFlow(filters);
  const sales = useSalesPerformance(filters);
  const receivablesAging = useReceivablesAging();
  const payablesAging = usePayablesAging();
  const cashByBranch = useCashByBranch();
  const topItems = useTopItems(filters);

  const openDrawerCash = (cashByBranch.data ?? []).reduce((sum, row) => sum + row.expectedCash, 0);
  const openSessions = (cashByBranch.data ?? []).reduce((sum, row) => sum + row.openSessions, 0);
  const periodLabel = `${formatDate(filters.from)} – ${formatDate(filters.to)}`;
  const topCustomers = sales.data?.byCustomer.slice(0, 5) ?? [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Month-to-date performance for ${periodLabel}, plus aging, branch cash, and activity.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/reports">
                <BarChart3 className="h-4 w-4" /> Reports
              </Link>
            </Button>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Gross Revenue (MTD)"
          value={<MoneyDisplay value={profitLoss.data?.grossRevenue ?? 0} currency={currency} />}
          hint="Invoices + POS for the current period"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="success"
        />
        <MetricCard
          label="Expenses (MTD)"
          value={<MoneyDisplay value={profitLoss.data?.totalExpenses ?? 0} currency={currency} />}
          hint="Bills + quick expenses"
          icon={<TrendingDown className="h-5 w-5" />}
          accent="warning"
        />
        <MetricCard
          label="Net Profit (MTD)"
          value={
            <MoneyDisplay
              value={profitLoss.data?.netProfit ?? 0}
              currency={currency}
              negative={(profitLoss.data?.netProfit ?? 0) < 0}
            />
          }
          hint="Net revenue after expenses"
          icon={<Wallet className="h-5 w-5" />}
          accent={(profitLoss.data?.netProfit ?? 0) >= 0 ? "primary" : "danger"}
        />
        <MetricCard
          label="Net Cash Flow (MTD)"
          value={
            <MoneyDisplay
              value={cashFlow.data?.netCashFlow ?? 0}
              currency={currency}
              negative={(cashFlow.data?.netCashFlow ?? 0) < 0}
            />
          }
          hint="Cash in minus cash out"
          icon={<Banknote className="h-5 w-5" />}
          accent={(cashFlow.data?.netCashFlow ?? 0) >= 0 ? "info" : "danger"}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Open A/R"
          value={<MoneyDisplay value={receivablesAging.data?.total ?? 0} currency={currency} />}
          hint={`${agingCount(receivablesAging.data)} open invoices`}
          icon={<AlertCircle className="h-5 w-5" />}
          accent="info"
        />
        <MetricCard
          label="Open A/P"
          value={<MoneyDisplay value={payablesAging.data?.total ?? 0} currency={currency} />}
          hint={`${agingCount(payablesAging.data)} open bills`}
          icon={<Receipt className="h-5 w-5" />}
          accent="danger"
        />
        <MetricCard
          label="Customers"
          value={activity.data?.customersCount ?? 0}
          hint="Active customer records"
          icon={<Users className="h-5 w-5" />}
          accent="primary"
        />
        <MetricCard
          label="Open Drawer Cash"
          value={<MoneyDisplay value={openDrawerCash} currency={currency} />}
          hint={`${openSessions} open sessions across ${cashByBranch.data?.length ?? 0} branches`}
          icon={<Wallet className="h-5 w-5" />}
          accent="warning"
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <AgingSection
          title="Receivables Aging"
          data={receivablesAging.data}
          isLoading={receivablesAging.isLoading}
          currency={currency}
          href="/invoices"
          ctaLabel="View invoices"
        />
        <AgingSection
          title="Payables Aging"
          data={payablesAging.data}
          isLoading={payablesAging.isLoading}
          currency={currency}
          href="/bills"
          ctaLabel="View bills"
        />
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Cash by branch</h2>
            <Link
              to="/cash-sessions"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Cash sessions <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Open sessions</TableHead>
                <TableHead className="text-right">Expected cash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashByBranch.isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!cashByBranch.isLoading && (cashByBranch.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    No open sessions.
                  </TableCell>
                </TableRow>
              )}
              {cashByBranch.data?.map((branch) => (
                <TableRow key={branch.branchId ?? branch.branchName}>
                  <TableCell>{branch.branchName}</TableCell>
                  <TableCell className="text-right">{branch.openSessions}</TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={branch.expectedCash} currency={currency} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Total open cash</TableCell>
                <TableCell className="text-right">{openSessions}</TableCell>
                <TableCell className="text-right">
                  <MoneyDisplay value={openDrawerCash} currency={currency} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </section>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Top customers (MTD)</h2>
            <Link
              to="/reports/sales"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Sales report <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!sales.isLoading && topCustomers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    No customer sales yet this month.
                  </TableCell>
                </TableRow>
              )}
              {topCustomers.map((customer) => (
                <TableRow key={customer.name}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-right">{customer.count}</TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={customer.amount} currency={currency} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Top items (MTD)</h2>
            <Link
              to="/reports/sales"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Sales report <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topItems.isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!topItems.isLoading && (topItems.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    No sold items yet this month.
                  </TableCell>
                </TableRow>
              )}
              {topItems.data?.map((item) => (
                <TableRow key={item.label}>
                  <TableCell className="max-w-[260px] truncate font-medium">{item.label}</TableCell>
                  <TableCell className="text-right font-mono">{item.quantity.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={item.amount} currency={currency} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
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
            {activity.isLoading && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {!activity.isLoading && (activity.data?.recentInvoices.length ?? 0) === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                <FileText className="mx-auto mb-2 h-6 w-6 opacity-50" />
                No invoices yet.
              </div>
            )}
            {activity.data?.recentInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{invoice.invoice_number}</p>
                  <p className="truncate font-medium">{invoice.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(invoice.issue_date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={invoice.status} />
                  <MoneyDisplay value={invoice.total} currency={currency} className="text-sm" />
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
            {activity.isLoading && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {!activity.isLoading && (activity.data?.recentPayments.length ?? 0) === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No payments yet.
              </div>
            )}
            {activity.data?.recentPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {payment.direction === "in" ? "Received" : "Sent"} ·{" "}
                    {payment.method.replace("_", " ")}
                  </p>
                  <p className="truncate font-medium">{payment.reference ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(payment.paid_at)}</p>
                </div>
                <MoneyDisplay
                  value={payment.amount}
                  currency={currency}
                  className={payment.direction === "in" ? "text-success" : ""}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
