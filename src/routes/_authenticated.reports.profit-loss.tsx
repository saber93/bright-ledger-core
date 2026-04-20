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
import {
  ReportFilterBar,
  defaultFilters,
} from "@/components/reports/ReportFilterBar";
import { useProfitLoss } from "@/features/reports/hooks";
import { useAuth } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { ArrowLeft, Download, Printer, TrendingDown, TrendingUp, Wallet, Undo2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/profit-loss")({
  component: ProfitLossPage,
});

function ProfitLossPage() {
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";
  const [filters, setFilters] = useState(defaultFilters());
  const { data, isLoading } = useProfitLoss(filters);

  const handleExport = () => {
    if (!data) return;
    const headers = ["Source", "Number", "Date", "Counterparty", "Type", "Amount"];
    const rows: Array<Array<unknown>> = [];
    for (const r of data.revenue.rows) {
      rows.push([r.source, r.number, r.date, r.counterparty, "Revenue", r.amount.toFixed(2)]);
    }
    for (const r of data.expenses.rows) {
      rows.push([r.source, r.number, r.date, r.counterparty, "Expense", r.amount.toFixed(2)]);
    }
    rows.push([]);
    rows.push(["", "", "", "", "Gross Revenue", data.grossRevenue.toFixed(2)]);
    rows.push(["", "", "", "", "Refunds", (-data.refunds.total).toFixed(2)]);
    rows.push(["", "", "", "", "Net Revenue", data.netRevenue.toFixed(2)]);
    rows.push(["", "", "", "", "Total Expenses", (-data.totalExpenses).toFixed(2)]);
    rows.push(["", "", "", "", "Net Profit", data.netProfit.toFixed(2)]);
    downloadCsv(`profit-loss_${filters.from}_to_${filters.to}.csv`, headers, rows);
  };

  return (
    <div>
      <PageHeader
        title="Profit & Loss"
        description="Posted income minus posted expenses for the selected period."
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
          label="Gross Revenue"
          value={<MoneyDisplay value={data?.grossRevenue ?? 0} currency={currency} />}
          hint="Posted income excluding tax"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="success"
        />
        <MetricCard
          label="Refunds"
          value={<MoneyDisplay value={data?.refunds.total ?? 0} currency={currency} />}
          hint="Issued credit notes"
          icon={<Undo2 className="h-5 w-5" />}
          accent="warning"
        />
        <MetricCard
          label="Total Expenses"
          value={<MoneyDisplay value={data?.totalExpenses ?? 0} currency={currency} />}
          hint="Bills, quick expenses, and COGS"
          icon={<TrendingDown className="h-5 w-5" />}
          accent="danger"
        />
        <MetricCard
          label="Net Profit"
          value={<MoneyDisplay value={data?.netProfit ?? 0} currency={currency} />}
          hint="Net revenue − expenses"
          icon={<Wallet className="h-5 w-5" />}
          accent={(data?.netProfit ?? 0) >= 0 ? "primary" : "danger"}
        />
      </div>

      <section className="mt-4 rounded-xl border border-info/30 bg-info/5 px-5 py-4 text-sm text-muted-foreground">
        This statement now reconciles from posted ledger activity. Revenue and expenses are
        shown net of tax, and POS cost of goods sold is included.
      </section>

      <section className="mt-6 rounded-xl border bg-card">
        <div className="border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold">Revenue breakdown</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Counterparty</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.revenue.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No revenue in this period.
                </TableCell>
              </TableRow>
            )}
            {data?.revenue.rows.map((r) => (
              <TableRow key={`${r.source}-${r.number}`}>
                <TableCell>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                    {r.source}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.number}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(r.date)}</TableCell>
                <TableCell>{r.counterparty}</TableCell>
                <TableCell className="text-right">
                  <MoneyDisplay value={r.amount} currency={currency} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="font-semibold">
                Total revenue
              </TableCell>
              <TableCell className="text-right font-semibold">
                <MoneyDisplay value={data?.revenue.total ?? 0} currency={currency} />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>

      <section className="mt-6 rounded-xl border bg-card">
        <div className="border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold">Expense breakdown</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Counterparty</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && data?.expenses.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No expenses in this period.
                </TableCell>
              </TableRow>
            )}
            {data?.expenses.rows.map((r) => (
              <TableRow key={`${r.source}-${r.number}`}>
                <TableCell>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                    {r.source}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.number}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(r.date)}</TableCell>
                <TableCell>{r.counterparty}</TableCell>
                <TableCell className="text-right">
                  <MoneyDisplay value={r.amount} currency={currency} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="font-semibold">
                Total expenses
              </TableCell>
              <TableCell className="text-right font-semibold">
                <MoneyDisplay value={data?.expenses.total ?? 0} currency={currency} />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Summary</h2>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gross revenue</span>
            <MoneyDisplay value={data?.grossRevenue ?? 0} currency={currency} />
          </div>
          <div className="flex justify-between text-warning-foreground">
            <span>Less refunds</span>
            <span>
              − <MoneyDisplay value={data?.refunds.total ?? 0} currency={currency} />
            </span>
          </div>
          <div className="flex justify-between border-t pt-2 font-medium">
            <span>Net revenue</span>
            <MoneyDisplay value={data?.netRevenue ?? 0} currency={currency} />
          </div>
          <div className="flex justify-between text-destructive">
            <span>Less total expenses</span>
            <span>
              − <MoneyDisplay value={data?.totalExpenses ?? 0} currency={currency} />
            </span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Net profit</span>
            <MoneyDisplay value={data?.netProfit ?? 0} currency={currency} />
          </div>
        </div>
      </section>
    </div>
  );
}
