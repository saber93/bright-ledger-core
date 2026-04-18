import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { MetricCard } from "@/components/data/MetricCard";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
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
import { ReportFilterBar, defaultFilters } from "@/components/reports/ReportFilterBar";
import { useSalesPerformance } from "@/features/reports/hooks";
import { useAuth } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { ArrowLeft, BarChart3, Download, Printer, ShoppingCart, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/sales")({
  component: SalesReportPage,
});

function SalesReportPage() {
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";
  const [filters, setFilters] = useState(defaultFilters());
  const { data, isLoading } = useSalesPerformance(filters);

  const handleExport = () => {
    if (!data) return;
    const headers = ["Source", "Number", "Date", "Counterparty", "Branch", "Amount"];
    const rows = data.rows.map((r) => [
      r.source,
      r.number,
      r.date,
      r.counterparty,
      r.branch,
      r.amount.toFixed(2),
    ]);
    rows.push([]);
    rows.push(["", "", "", "", "Total", data.totalSales.toFixed(2)]);
    downloadCsv(`sales_${filters.from}_to_${filters.to}.csv`, headers, rows);
  };

  return (
    <div>
      <PageHeader
        title="Sales Performance"
        description="Sales by customer, branch and channel."
        breadcrumbs={
          <Link to="/reports" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Reports
          </Link>
        }
        actions={
          <>
            <Button variant="outline" onClick={handleExport} disabled={!data}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!data}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </>
        }
      />

      <ReportFilterBar value={filters} onChange={setFilters} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Sales"
          value={<MoneyDisplay value={data?.totalSales ?? 0} currency={currency} />}
          hint={`${data?.orderCount ?? 0} transactions`}
          icon={<BarChart3 className="h-5 w-5" />}
          accent="primary"
        />
        <MetricCard
          label="Invoice Sales"
          value={<MoneyDisplay value={data?.invoiceTotal ?? 0} currency={currency} />}
          hint="Customer invoices"
          icon={<Users className="h-5 w-5" />}
          accent="info"
        />
        <MetricCard
          label="POS Sales"
          value={<MoneyDisplay value={data?.posTotal ?? 0} currency={currency} />}
          hint="Completed POS orders"
          icon={<ShoppingCart className="h-5 w-5" />}
          accent="success"
        />
        <MetricCard
          label="Avg Ticket"
          value={<MoneyDisplay value={data?.avgTicket ?? 0} currency={currency} />}
          hint="Average per transaction"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <div className="border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">By customer</h2>
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
              {!isLoading && data?.byCustomer.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                    No sales.
                  </TableCell>
                </TableRow>
              )}
              {data?.byCustomer.slice(0, 10).map((c) => (
                <TableRow key={c.name}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="text-right">{c.count}</TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={c.amount} currency={currency} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">By branch / channel</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && data?.byBranch.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                    No sales.
                  </TableCell>
                </TableRow>
              )}
              {data?.byBranch.map((b) => (
                <TableRow key={b.branchId ?? b.name}>
                  <TableCell>{b.name}</TableCell>
                  <TableCell className="text-right">{b.count}</TableCell>
                  <TableCell className="text-right">
                    <MoneyDisplay value={b.amount} currency={currency} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-card">
        <div className="border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold">Transactions</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Counterparty</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No sales in this period.
                </TableCell>
              </TableRow>
            )}
            {data?.rows.map((r) => (
              <TableRow key={`${r.source}-${r.number}`}>
                <TableCell>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                    {r.source}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.number}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(r.date)}</TableCell>
                <TableCell>{r.counterparty}</TableCell>
                <TableCell>{r.branch}</TableCell>
                <TableCell className="text-right">
                  <MoneyDisplay value={r.amount} currency={currency} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} className="font-semibold">
                Total
              </TableCell>
              <TableCell className="text-right font-semibold">
                <MoneyDisplay value={data?.totalSales ?? 0} currency={currency} />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>
    </div>
  );
}
