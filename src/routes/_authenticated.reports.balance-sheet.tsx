import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Download, Printer, Scale } from "lucide-react";
import { PageHeader } from "@/components/data/PageHeader";
import { MetricCard } from "@/components/data/MetricCard";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBranches } from "@/features/branches/hooks";
import { useAccountBalances } from "@/features/accounting/ledger";
import { downloadCsv } from "@/lib/csv";
import { useAuth } from "@/lib/auth";

const ALL_BRANCHES = "__all__";

function todayInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function yearStartInput(dateString: string) {
  return `${dateString.slice(0, 4)}-01-01`;
}

export const Route = createFileRoute("/_authenticated/reports/balance-sheet")({
  component: BalanceSheetPage,
});

function BalanceSheetPage() {
  const { company } = useAuth();
  const { data: branches } = useBranches();
  const currency = company?.currency ?? "USD";
  const [asOf, setAsOf] = useState(todayInput());
  const [branchId, setBranchId] = useState<string | null>(null);
  const { data, isLoading } = useAccountBalances(asOf, branchId);

  const sections = useMemo(() => {
    const rows = data ?? [];
    const assets = rows
      .filter((row) => row.account_type === "asset" && Math.abs(row.balance_net) > 0.005)
      .map((row) => ({ ...row, amount: row.balance_net }));
    const liabilities = rows
      .filter((row) => row.account_type === "liability" && Math.abs(row.balance_net) > 0.005)
      .map((row) => ({ ...row, amount: -row.balance_net }));
    const equityAccounts = rows
      .filter((row) => row.account_type === "equity" && Math.abs(row.balance_net) > 0.005)
      .map((row) => ({ ...row, amount: -row.balance_net }));
    const currentEarnings = -rows
      .filter((row) => row.account_type === "income" || row.account_type === "expense")
      .reduce((sum, row) => sum + row.balance_net, 0);

    const equity = [...equityAccounts];
    if (Math.abs(currentEarnings) > 0.005) {
      equity.push({
        account_id: "__current_earnings__",
        account_code: "CYE",
        account_name: "Current Earnings",
        account_type: "equity" as const,
        balance_net: -currentEarnings,
        debit_balance: 0,
        credit_balance: 0,
        amount: currentEarnings,
      });
    }

    const assetsTotal = assets.reduce((sum, row) => sum + row.amount, 0);
    const liabilitiesTotal = liabilities.reduce((sum, row) => sum + row.amount, 0);
    const equityTotal = equity.reduce((sum, row) => sum + row.amount, 0);

    return {
      assets,
      liabilities,
      equity,
      assetsTotal,
      liabilitiesTotal,
      equityTotal,
      liabilitiesAndEquity: liabilitiesTotal + equityTotal,
      difference: assetsTotal - (liabilitiesTotal + equityTotal),
    };
  }, [data]);

  const handleExport = () => {
    const headers = ["Section", "Code", "Account", "Amount"];
    const rows: Array<Array<string>> = [];

    for (const asset of sections.assets) {
      rows.push(["Assets", asset.account_code, asset.account_name, asset.amount.toFixed(2)]);
    }
    rows.push(["Assets", "", "Total Assets", sections.assetsTotal.toFixed(2)]);
    rows.push([]);

    for (const liability of sections.liabilities) {
      rows.push([
        "Liabilities",
        liability.account_code,
        liability.account_name,
        liability.amount.toFixed(2),
      ]);
    }
    rows.push(["Liabilities", "", "Total Liabilities", sections.liabilitiesTotal.toFixed(2)]);
    rows.push([]);

    for (const equity of sections.equity) {
      rows.push(["Equity", equity.account_code, equity.account_name, equity.amount.toFixed(2)]);
    }
    rows.push(["Equity", "", "Total Equity", sections.equityTotal.toFixed(2)]);
    rows.push([]);
    rows.push([
      "",
      "",
      "Total Liabilities + Equity",
      sections.liabilitiesAndEquity.toFixed(2),
    ]);
    rows.push(["", "", "Imbalance", sections.difference.toFixed(2)]);

    downloadCsv(`balance-sheet_as-of_${asOf}.csv`, headers, rows);
  };

  return (
    <div>
      <PageHeader
        title="Balance Sheet"
        description="Assets, liabilities, and equity as of the selected date."
        breadcrumbs={
          <Link to="/reports" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Reports
          </Link>
        }
        actions={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">As of</Label>
          <Input
            type="date"
            value={asOf}
            onChange={(event) => setAsOf(event.target.value)}
            className="h-9 w-[170px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Branch</Label>
          <Select
            value={branchId ?? ALL_BRANCHES}
            onValueChange={(value) => setBranchId(value === ALL_BRANCHES ? null : value)}
          >
            <SelectTrigger className="h-9 w-[210px]">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_BRANCHES}>All branches</SelectItem>
              {(branches ?? []).map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Total Assets"
          value={<MoneyDisplay value={sections.assetsTotal} currency={currency} />}
          icon={<Scale className="h-5 w-5" />}
          accent="info"
        />
        <MetricCard
          label="Liabilities + Equity"
          value={<MoneyDisplay value={sections.liabilitiesAndEquity} currency={currency} />}
          icon={<Scale className="h-5 w-5" />}
          accent="success"
        />
        <MetricCard
          label="Imbalance"
          value={<MoneyDisplay value={sections.difference} currency={currency} />}
          hint={
            Math.abs(sections.difference) <= 0.005
              ? "Balanced"
              : "Validation problem"
          }
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={Math.abs(sections.difference) <= 0.005 ? "primary" : "danger"}
        />
      </div>

      <section
        className={`mt-6 rounded-xl border px-5 py-4 ${
          Math.abs(sections.difference) <= 0.005
            ? "border-success/30 bg-success/5"
            : "border-destructive/30 bg-destructive/5"
        }`}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={`mt-0.5 h-4 w-4 ${
              Math.abs(sections.difference) <= 0.005 ? "text-success" : "text-destructive"
            }`}
          />
          <div>
            <p className="text-sm font-semibold">
              {Math.abs(sections.difference) <= 0.005
                ? "Balance Sheet is in balance."
                : "Balance Sheet is out of balance."}
            </p>
            <p className="text-sm text-muted-foreground">
              {Math.abs(sections.difference) <= 0.005
                ? "Total assets equal total liabilities plus equity, including current earnings."
                : "Total assets do not equal total liabilities plus equity. Treat this as a ledger validation problem."}
            </p>
          </div>
        </div>
      </section>

      <BalanceSheetSection
        title="Assets"
        rows={sections.assets}
        total={sections.assetsTotal}
        currency={currency}
        ledgerFrom={yearStartInput(asOf)}
        asOf={asOf}
        branchId={branchId}
        loading={isLoading}
      />
      <BalanceSheetSection
        title="Liabilities"
        rows={sections.liabilities}
        total={sections.liabilitiesTotal}
        currency={currency}
        ledgerFrom={yearStartInput(asOf)}
        asOf={asOf}
        branchId={branchId}
        loading={isLoading}
      />
      <BalanceSheetSection
        title="Equity"
        rows={sections.equity}
        total={sections.equityTotal}
        currency={currency}
        ledgerFrom={yearStartInput(asOf)}
        asOf={asOf}
        branchId={branchId}
        loading={isLoading}
      />
    </div>
  );
}

function BalanceSheetSection({
  title,
  rows,
  total,
  currency,
  ledgerFrom,
  asOf,
  branchId,
  loading,
}: {
  title: string;
  rows: Array<{
    account_id: string;
    account_code: string;
    account_name: string;
    amount: number;
  }>;
  total: number;
  currency: string;
  ledgerFrom: string;
  asOf: string;
  branchId: string | null;
  loading: boolean;
}) {
  return (
    <section className="mt-6 rounded-xl border bg-card">
      <div className="border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                No balances in this section.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={`${title}-${row.account_id}`}>
              <TableCell className="font-mono text-xs">{row.account_code}</TableCell>
              <TableCell>
                {row.account_id === "__current_earnings__" ? (
                  row.account_name
                ) : (
                  <Link
                    to="/reports/ledger"
                    search={{
                      accountId: row.account_id,
                      from: ledgerFrom,
                      to: asOf,
                      branchId: branchId ?? undefined,
                    }}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.account_name}
                  </Link>
                )}
              </TableCell>
              <TableCell className="text-right">
                <MoneyDisplay value={row.amount} currency={currency} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-semibold">
              Total {title}
            </TableCell>
            <TableCell className="text-right font-semibold">
              <MoneyDisplay value={total} currency={currency} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </section>
  );
}
