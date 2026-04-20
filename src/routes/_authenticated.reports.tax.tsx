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
import { useTaxSummary } from "@/features/reports/hooks";
import { useAuth } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Download, PieChart, Printer, Undo2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/tax")({
  component: TaxReportPage,
});

function TaxReportPage() {
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";
  const [filters, setFilters] = useState(defaultFilters());
  const { data, isLoading } = useTaxSummary(filters);

  const handleExport = () => {
    if (!data) return;
    const headers = ["Direction", "Source", "Number", "Date", "Taxable", "Tax"];
    const rows = data.rows.map((r) => [
      r.direction,
      r.source,
      r.number,
      r.date,
      r.taxable.toFixed(2),
      r.tax.toFixed(2),
    ]);
    rows.push([]);
    rows.push(["", "", "", "", "Output tax", data.outputTax.total.toFixed(2)]);
    rows.push(["", "", "", "", "Refunded tax", (-data.refundedTax).toFixed(2)]);
    rows.push(["", "", "", "", "Input tax", (-data.inputTax.total).toFixed(2)]);
    rows.push(["", "", "", "", "Net tax payable", data.netTaxPayable.toFixed(2)]);
    downloadCsv(`tax_${filters.from}_to_${filters.to}.csv`, headers, rows);
  };

  return (
    <div>
      <PageHeader
        title="Tax Summary"
        description="Output, input, refunded and net payable tax."
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
          label="Output Tax"
          value={<MoneyDisplay value={data?.outputTax.total ?? 0} currency={currency} />}
          hint="Invoices + POS"
          icon={<ArrowUpFromLine className="h-5 w-5" />}
          accent="info"
        />
        <MetricCard
          label="Refunded Tax"
          value={<MoneyDisplay value={data?.refundedTax ?? 0} currency={currency} />}
          hint="From credit notes"
          icon={<Undo2 className="h-5 w-5" />}
          accent="warning"
        />
        <MetricCard
          label="Input Tax"
          value={<MoneyDisplay value={data?.inputTax.total ?? 0} currency={currency} />}
          hint="Bills + quick expenses"
          icon={<ArrowDownToLine className="h-5 w-5" />}
          accent="success"
        />
        <MetricCard
          label="Net Tax Payable"
          value={<MoneyDisplay value={data?.netTaxPayable ?? 0} currency={currency} />}
          hint="Output − refunded − input"
          icon={<PieChart className="h-5 w-5" />}
          accent={(data?.netTaxPayable ?? 0) >= 0 ? "primary" : "danger"}
        />
      </div>

      <section className="mt-6 rounded-xl border bg-card">
        <div className="border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold">Tax detail</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Direction</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">Tax</TableHead>
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
                  No tax events in this period.
                </TableCell>
              </TableRow>
            )}
            {data?.rows.map((r) => (
              <TableRow key={`${r.source}-${r.number}-${r.direction}`}>
                <TableCell>
                  <span
                    className={
                      "rounded px-1.5 py-0.5 text-xs font-medium " +
                      (r.direction === "output"
                        ? "bg-info/10 text-info"
                        : r.direction === "input"
                          ? "bg-success/10 text-success"
                          : "bg-warning/15 text-warning-foreground")
                    }
                  >
                    {r.direction}
                  </span>
                </TableCell>
                <TableCell>{r.source}</TableCell>
                <TableCell className="font-mono text-xs">{r.number}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(r.date)}</TableCell>
                <TableCell className="text-right">
                  <MoneyDisplay value={r.taxable} currency={currency} />
                </TableCell>
                <TableCell className="text-right">
                  <MoneyDisplay value={r.tax} currency={currency} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} className="font-semibold">
                Net tax payable
              </TableCell>
              <TableCell className="text-right font-semibold">
                <MoneyDisplay value={data?.netTaxPayable ?? 0} currency={currency} />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>
    </div>
  );
}
