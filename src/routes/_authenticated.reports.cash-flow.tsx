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
import { useCashFlow } from "@/features/reports/hooks";
import { useAuth } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { ArrowDown, ArrowLeft, ArrowUp, Download, Printer, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/cash-flow")({
  component: CashFlowPage,
});

function CashFlowPage() {
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";
  const [filters, setFilters] = useState(defaultFilters());
  const { data, isLoading } = useCashFlow(filters);

  const handleExport = () => {
    if (!data) return;
    const headers = ["Date", "Type", "Method", "Reference", "Inflow", "Outflow"];
    const rows = data.rows.map((r) => [
      r.date,
      r.type,
      r.method,
      r.reference,
      r.inflow.toFixed(2),
      r.outflow.toFixed(2),
    ]);
    rows.push([]);
    rows.push(["", "", "", "Total inflow", data.inflow.total.toFixed(2), ""]);
    rows.push(["", "", "", "Total outflow", "", data.outflow.total.toFixed(2)]);
    rows.push(["", "", "", "Net cash flow", data.netCashFlow.toFixed(2), ""]);
    downloadCsv(`cash-flow_${filters.from}_to_${filters.to}.csv`, headers, rows);
  };

  return (
    <div>
      <PageHeader
        title="Cash Flow"
        description="Cash inflows and outflows across all payment methods."
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
          label="Total Inflow"
          value={<MoneyDisplay value={data?.inflow.total ?? 0} currency={currency} />}
          hint="Customer + POS + cash-in"
          icon={<ArrowDown className="h-5 w-5" />}
          accent="success"
        />
        <MetricCard
          label="Total Outflow"
          value={<MoneyDisplay value={data?.outflow.total ?? 0} currency={currency} />}
          hint="Suppliers + expenses + refunds"
          icon={<ArrowUp className="h-5 w-5" />}
          accent="danger"
        />
        <MetricCard
          label="Net Cash Flow"
          value={<MoneyDisplay value={data?.netCashFlow ?? 0} currency={currency} />}
          hint="Inflow − Outflow"
          icon={<Wallet className="h-5 w-5" />}
          accent={(data?.netCashFlow ?? 0) >= 0 ? "primary" : "danger"}
        />
        <MetricCard
          label="POS Cash"
          value={<MoneyDisplay value={data?.inflow.posPayments ?? 0} currency={currency} />}
          hint="From POS payments"
          accent="info"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <div className="border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Inflow breakdown</h2>
          </div>
          <div className="space-y-2 p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer payments</span>
              <MoneyDisplay value={data?.inflow.customerPayments ?? 0} currency={currency} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">POS payments</span>
              <MoneyDisplay value={data?.inflow.posPayments ?? 0} currency={currency} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Drawer cash-ins</span>
              <MoneyDisplay value={data?.inflow.cashIns ?? 0} currency={currency} />
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total inflow</span>
              <MoneyDisplay value={data?.inflow.total ?? 0} currency={currency} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Outflow breakdown</h2>
          </div>
          <div className="space-y-2 p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Supplier payments</span>
              <MoneyDisplay value={data?.outflow.supplierPayments ?? 0} currency={currency} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quick expenses</span>
              <MoneyDisplay value={data?.outflow.quickExpenses ?? 0} currency={currency} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cash refunds</span>
              <MoneyDisplay value={data?.outflow.cashRefunds ?? 0} currency={currency} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Drawer cash-outs / payouts</span>
              <MoneyDisplay value={data?.outflow.cashOuts ?? 0} currency={currency} />
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total outflow</span>
              <MoneyDisplay value={data?.outflow.total ?? 0} currency={currency} />
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-card">
        <div className="border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold">By method</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Inflow</TableHead>
              <TableHead className="text-right">Outflow</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && data?.byMethod.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  No movement.
                </TableCell>
              </TableRow>
            )}
            {data?.byMethod.map((m) => (
              <TableRow key={m.method}>
                <TableCell className="capitalize">{m.method.replace("_", " ")}</TableCell>
                <TableCell className="text-right">
                  <MoneyDisplay value={m.inflow} currency={currency} />
                </TableCell>
                <TableCell className="text-right">
                  <MoneyDisplay value={m.outflow} currency={currency} />
                </TableCell>
                <TableCell className="text-right">
                  <MoneyDisplay value={m.inflow - m.outflow} currency={currency} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="mt-6 rounded-xl border bg-card">
        <div className="border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold">Movements</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Inflow</TableHead>
              <TableHead className="text-right">Outflow</TableHead>
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
                  No cash movement in this period.
                </TableCell>
              </TableRow>
            )}
            {data?.rows.map((r, idx) => (
              <TableRow key={`${r.date}-${r.reference}-${idx}`}>
                <TableCell className="text-muted-foreground">{formatDate(r.date)}</TableCell>
                <TableCell>{r.type}</TableCell>
                <TableCell className="capitalize">{r.method.replace("_", " ")}</TableCell>
                <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                <TableCell className="text-right">
                  {r.inflow > 0 ? <MoneyDisplay value={r.inflow} currency={currency} /> : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {r.outflow > 0 ? <MoneyDisplay value={r.outflow} currency={currency} /> : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="font-semibold">
                Totals
              </TableCell>
              <TableCell className="text-right font-semibold">
                <MoneyDisplay value={data?.inflow.total ?? 0} currency={currency} />
              </TableCell>
              <TableCell className="text-right font-semibold">
                <MoneyDisplay value={data?.outflow.total ?? 0} currency={currency} />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>
    </div>
  );
}
