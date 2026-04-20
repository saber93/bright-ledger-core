import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download, Printer } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportFilterBar, defaultFilters } from "@/components/reports/ReportFilterBar";
import {
  useAccountBalances,
  useAccountLedger,
} from "@/features/accounting/ledger";
import { useChartOfAccounts } from "@/features/accounting/hooks";
import { downloadCsv } from "@/lib/csv";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";

type LedgerSearch = {
  accountId?: string;
  from?: string;
  to?: string;
  branchId?: string;
};

export const Route = createFileRoute("/_authenticated/reports/ledger")({
  validateSearch: (search: Record<string, unknown>): LedgerSearch => ({
    accountId: typeof search.accountId === "string" ? search.accountId : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
    branchId: typeof search.branchId === "string" ? search.branchId : undefined,
  }),
  component: LedgerPage,
});

function LedgerPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";
  const { data: accounts } = useChartOfAccounts();

  const [filters, setFilters] = useState(() => ({
    ...defaultFilters(),
    from: search.from ?? defaultFilters().from,
    to: search.to ?? defaultFilters().to,
    branchId: search.branchId ?? null,
  }));
  const [accountId, setAccountId] = useState(search.accountId ?? "");

  useEffect(() => {
    const defaults = defaultFilters();
    setFilters({
      from: search.from ?? defaults.from,
      to: search.to ?? defaults.to,
      branchId: search.branchId ?? null,
    });
    setAccountId(search.accountId ?? "");
  }, [search.accountId, search.branchId, search.from, search.to]);

  useEffect(() => {
    void navigate({
      to: "/reports/ledger",
      search: {
        accountId: accountId || undefined,
        from: filters.from,
        to: filters.to,
        branchId: filters.branchId ?? undefined,
      },
      replace: true,
    });
  }, [accountId, filters, navigate]);

  const ledger = useAccountLedger(accountId || undefined, filters);
  const balances = useAccountBalances(filters.to, filters.branchId);

  const selectedAccount = (accounts ?? []).find((account) => account.id === accountId) ?? null;
  const selectedBalance = (balances.data ?? []).find((row) => row.account_id === accountId) ?? null;

  const summary = useMemo(() => {
    const rows = ledger.data ?? [];
    const openingBalance = rows[0]?.opening_balance ?? 0;
    const periodDebit = rows.reduce((sum, row) => sum + row.debit, 0);
    const periodCredit = rows.reduce((sum, row) => sum + row.credit, 0);
    const closingBalance =
      rows.length > 0
        ? rows[rows.length - 1]?.running_balance ?? 0
        : selectedBalance?.balance_net ?? openingBalance;
    return {
      openingBalance,
      periodDebit,
      periodCredit,
      closingBalance,
    };
  }, [ledger.data, selectedBalance]);

  const trailing = (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">Account</Label>
      <Select value={accountId || undefined} onValueChange={setAccountId}>
        <SelectTrigger className="h-9 w-[260px]">
          <SelectValue placeholder="Select an account" />
        </SelectTrigger>
        <SelectContent>
          {(accounts ?? []).map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.code} · {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const handleExport = () => {
    if (!selectedAccount || !ledger.data) return;
    const headers = [
      "Date",
      "Posted At",
      "Document",
      "Reference",
      "Description",
      "Method",
      "Debit",
      "Credit",
      "Running Balance",
    ];
    const rows = ledger.data.map((row) => [
      row.journal_date,
      row.posted_at ?? "",
      row.document_number,
      row.reference ?? "",
      row.description,
      row.payment_method ?? "",
      row.debit.toFixed(2),
      row.credit.toFixed(2),
      row.running_balance.toFixed(2),
    ]);
    rows.push([]);
    rows.push(["", "", "", "", "Opening balance", "", "", "", summary.openingBalance.toFixed(2)]);
    rows.push(["", "", "", "", "Closing balance", "", "", "", summary.closingBalance.toFixed(2)]);
    downloadCsv(
      `ledger_${selectedAccount.code}_${filters.from}_to_${filters.to}.csv`,
      headers,
      rows,
    );
  };

  return (
    <div>
      <PageHeader
        title="General Ledger"
        description="Inspect the journal lines behind an account balance."
        breadcrumbs={
          <Link to="/reports" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Reports
          </Link>
        }
        actions={
          <>
            <Button variant="outline" onClick={handleExport} disabled={!accountId || !ledger.data}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!accountId}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </>
        }
      />

      <ReportFilterBar value={filters} onChange={setFilters} trailing={trailing} />

      {!accountId && (
        <section className="rounded-xl border bg-card p-8 text-sm text-muted-foreground">
          Select an account to inspect the journal lines behind its balance.
        </section>
      )}

      {accountId && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Opening Balance"
              value={<MoneyDisplay value={summary.openingBalance} currency={currency} />}
              hint={selectedAccount ? `${selectedAccount.code} · ${selectedAccount.name}` : undefined}
              accent="info"
            />
            <MetricCard
              label="Period Debits"
              value={<MoneyDisplay value={summary.periodDebit} currency={currency} />}
              accent="success"
            />
            <MetricCard
              label="Period Credits"
              value={<MoneyDisplay value={summary.periodCredit} currency={currency} />}
              accent="warning"
            />
            <MetricCard
              label="Closing Balance"
              value={<MoneyDisplay value={summary.closingBalance} currency={currency} />}
              accent="primary"
            />
          </div>

          <section className="mt-6 rounded-xl border bg-card">
            <div className="border-b px-5 py-3.5">
              <h2 className="text-sm font-semibold">Journal lines</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!ledger.isLoading && (ledger.data?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No ledger movement in this period.
                    </TableCell>
                  </TableRow>
                )}
                {ledger.data?.map((row) => (
                  <TableRow key={row.line_key}>
                    <TableCell className="text-muted-foreground">
                      <div>{formatDate(row.journal_date)}</div>
                      {row.posted_at && (
                        <div className="text-xs">{formatDateTime(row.posted_at)}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.source_href ? (
                        <a href={row.source_href} className="font-medium text-primary hover:underline">
                          {row.document_number}
                        </a>
                      ) : (
                        <span className="font-medium">{row.document_number}</span>
                      )}
                      <div className="font-mono text-xs text-muted-foreground">
                        {row.reference ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{row.description}</div>
                      {row.counterparty_name && (
                        <div className="text-xs text-muted-foreground">{row.counterparty_name}</div>
                      )}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {(row.payment_method ?? "—").replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.debit > 0 ? <MoneyDisplay value={row.debit} currency={currency} /> : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.credit > 0 ? <MoneyDisplay value={row.credit} currency={currency} /> : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <MoneyDisplay value={row.running_balance} currency={currency} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-semibold">
                    Period totals
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <MoneyDisplay value={summary.periodDebit} currency={currency} />
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <MoneyDisplay value={summary.periodCredit} currency={currency} />
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <MoneyDisplay value={summary.closingBalance} currency={currency} />
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </section>
        </>
      )}
    </div>
  );
}
