import { Fragment, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Download, Printer, Scale } from "lucide-react";
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
import { accountTypeLabel, useTrialBalance } from "@/features/accounting/ledger";
import { downloadCsv } from "@/lib/csv";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/reports/trial-balance")({
  component: TrialBalancePage,
});

function TrialBalancePage() {
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";
  const [filters, setFilters] = useState(defaultFilters());
  const { data, isLoading } = useTrialBalance(filters);

  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>>();
    for (const row of data ?? []) {
      const key = row.account_type;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [data]);

  const totals = useMemo(() => {
    const rows = data ?? [];
    const closingDebit = rows.reduce((sum, row) => sum + row.closing_debit, 0);
    const closingCredit = rows.reduce((sum, row) => sum + row.closing_credit, 0);
    const periodDebit = rows.reduce((sum, row) => sum + row.period_debit, 0);
    const periodCredit = rows.reduce((sum, row) => sum + row.period_credit, 0);
    return {
      closingDebit,
      closingCredit,
      periodDebit,
      periodCredit,
      difference: closingDebit - closingCredit,
    };
  }, [data]);

  const handleExport = () => {
    if (!data) return;
    const headers = [
      "Type",
      "Code",
      "Account",
      "Opening Debit",
      "Opening Credit",
      "Period Debit",
      "Period Credit",
      "Closing Debit",
      "Closing Credit",
    ];
    const rows = data.map((row) => [
      accountTypeLabel(row.account_type),
      row.account_code,
      row.account_name,
      row.opening_debit.toFixed(2),
      row.opening_credit.toFixed(2),
      row.period_debit.toFixed(2),
      row.period_credit.toFixed(2),
      row.closing_debit.toFixed(2),
      row.closing_credit.toFixed(2),
    ]);
    rows.push([]);
    rows.push([
      "",
      "",
      "Totals",
      "",
      "",
      totals.periodDebit.toFixed(2),
      totals.periodCredit.toFixed(2),
      totals.closingDebit.toFixed(2),
      totals.closingCredit.toFixed(2),
    ]);
    rows.push([
      "",
      "",
      "Imbalance",
      "",
      "",
      "",
      "",
      totals.difference.toFixed(2),
      "",
    ]);
    downloadCsv(`trial-balance_${filters.from}_to_${filters.to}.csv`, headers, rows);
  };

  return (
    <div>
      <PageHeader
        title="Trial Balance"
        description="Every posted ledger account balance for the selected period."
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

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Closing Debits"
          value={<MoneyDisplay value={totals.closingDebit} currency={currency} />}
          hint="All debit balances"
          icon={<Scale className="h-5 w-5" />}
          accent="info"
        />
        <MetricCard
          label="Closing Credits"
          value={<MoneyDisplay value={totals.closingCredit} currency={currency} />}
          hint="All credit balances"
          icon={<Scale className="h-5 w-5" />}
          accent="success"
        />
        <MetricCard
          label="Imbalance"
          value={<MoneyDisplay value={totals.difference} currency={currency} />}
          hint={
            Math.abs(totals.difference) <= 0.005
              ? "Balanced"
              : "Validation problem"
          }
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={Math.abs(totals.difference) <= 0.005 ? "primary" : "danger"}
        />
      </div>

      <section
        className={`mt-6 rounded-xl border px-5 py-4 ${
          Math.abs(totals.difference) <= 0.005
            ? "border-success/30 bg-success/5"
            : "border-destructive/30 bg-destructive/5"
        }`}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={`mt-0.5 h-4 w-4 ${
              Math.abs(totals.difference) <= 0.005 ? "text-success" : "text-destructive"
            }`}
          />
          <div>
            <p className="text-sm font-semibold">
              {Math.abs(totals.difference) <= 0.005
                ? "Trial Balance is in balance."
                : "Trial Balance is out of balance."}
            </p>
            <p className="text-sm text-muted-foreground">
              {Math.abs(totals.difference) <= 0.005
                ? "Closing debits and closing credits reconcile against the validated ledger source."
                : "Closing debits and credits do not reconcile. Treat this as a posting validation issue, not a display issue."}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-xl border bg-card">
        <div className="border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold">Accounts</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Opening Dr</TableHead>
              <TableHead className="text-right">Opening Cr</TableHead>
              <TableHead className="text-right">Period Dr</TableHead>
              <TableHead className="text-right">Period Cr</TableHead>
              <TableHead className="text-right">Closing Dr</TableHead>
              <TableHead className="text-right">Closing Cr</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No ledger activity in this period.
                </TableCell>
              </TableRow>
            )}
            {Array.from(grouped.entries()).map(([type, rows]) => (
              <Fragment key={type}>
                <TableRow key={`${type}-heading`} className="bg-muted/25">
                  <TableCell colSpan={8} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {accountTypeLabel(type as typeof rows[number]["account_type"])}
                  </TableCell>
                </TableRow>
                {rows?.map((row) => (
                  <TableRow key={row.account_id}>
                    <TableCell className="font-mono text-xs">{row.account_code}</TableCell>
                    <TableCell>
                      <Link
                        to="/reports/ledger"
                        search={{
                          accountId: row.account_id,
                          from: filters.from,
                          to: filters.to,
                          branchId: filters.branchId ?? undefined,
                        }}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.account_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyDisplay value={row.opening_debit} currency={currency} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyDisplay value={row.opening_credit} currency={currency} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyDisplay value={row.period_debit} currency={currency} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyDisplay value={row.period_credit} currency={currency} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyDisplay value={row.closing_debit} currency={currency} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyDisplay value={row.closing_credit} currency={currency} />
                    </TableCell>
                    </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="font-semibold">
                Totals
              </TableCell>
              <TableCell className="text-right font-semibold">
                <MoneyDisplay value={totals.periodDebit} currency={currency} />
              </TableCell>
              <TableCell className="text-right font-semibold">
                <MoneyDisplay value={totals.periodCredit} currency={currency} />
              </TableCell>
              <TableCell className="text-right font-semibold">
                <MoneyDisplay value={totals.closingDebit} currency={currency} />
              </TableCell>
              <TableCell className="text-right font-semibold">
                <MoneyDisplay value={totals.closingCredit} currency={currency} />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>
    </div>
  );
}
