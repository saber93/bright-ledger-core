import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Receipt, Plus, Filter, X } from "lucide-react";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { DataTable } from "@/components/data/DataTable";
import { MetricCard } from "@/components/data/MetricCard";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCompanySettings } from "@/features/settings/hooks";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import {
  useQuickExpenses,
  type QuickExpenseFilters,
  type QuickExpenseMethod,
  type QuickExpenseListItem,
} from "@/features/quick-expenses/hooks";
import { useChartOfAccounts } from "@/features/accounting/hooks";
import { useBranches } from "@/features/branches/hooks";
import { QuickExpenseDrawer } from "@/components/quick-expenses/QuickExpenseDrawer";

export const Route = createFileRoute("/_authenticated/quick-expenses")({
  component: QuickExpensesPage,
});

const METHOD_LABEL: Record<QuickExpenseMethod, string> = {
  cash: "Cash",
  bank: "Bank",
  card: "Card",
  petty_cash: "Petty cash",
  unpaid: "Unpaid",
  other: "Other",
};

function QuickExpensesPage() {
  const { data: settings } = useCompanySettings();
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";

  const [filters, setFilters] = useState<QuickExpenseFilters>({
    paid: "all",
  });
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuickExpenses(filters);
  const { data: accounts } = useChartOfAccounts();
  const { data: branches } = useBranches();

  const expenseAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.type === "expense" && a.is_active),
    [accounts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows ?? [];
    return (rows ?? []).filter(
      (r) =>
        r.description.toLowerCase().includes(q) ||
        r.expense_number.toLowerCase().includes(q) ||
        (r.supplier_name ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const kpis = useMemo(() => {
    const list = filtered ?? [];
    const totalAmount = list.reduce((s, r) => s + Number(r.amount) + Number(r.tax_amount ?? 0), 0);
    const unpaid = list.filter((r) => !r.paid);
    const unpaidAmount = unpaid.reduce(
      (s, r) => s + Number(r.amount) + Number(r.tax_amount ?? 0),
      0,
    );
    const taxTotal = list.reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);
    return { count: list.length, totalAmount, unpaidCount: unpaid.length, unpaidAmount, taxTotal };
  }, [filtered]);

  if (settings && !settings.quick_expenses_enabled) {
    return (
      <div>
        <PageHeader title="Quick Expenses" description="Module disabled" />
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="Quick Expenses are disabled"
          description="Enable Quick Expenses in Settings → Modules & Features to log small daily costs."
          action={
            <Button asChild variant="outline">
              <Link to="/settings/modules">Open module settings</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const activeFilterCount =
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0) +
    (filters.account_id ? 1 : 0) +
    (filters.payment_method ? 1 : 0) +
    (filters.branch_id ? 1 : 0) +
    (filters.paid && filters.paid !== "all" ? 1 : 0);

  return (
    <div>
      <PageHeader
        title="Quick Expenses"
        description="Fast capture for fuel, supplies, petty cash and other day-to-day costs. Separate from Supplier Bills."
        actions={
          <Button
            onClick={() => {
              setEditId(null);
              setDrawerOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New expense
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Expenses"
          value={kpis.count}
          hint={`${filters.from ?? "all time"} → ${filters.to ?? "now"}`}
          icon={<Receipt className="h-5 w-5" />}
          accent="primary"
        />
        <MetricCard
          label="Total spend"
          value={<MoneyDisplay value={kpis.totalAmount} currency={currency} />}
          hint="Including tax"
          accent="info"
        />
        <MetricCard
          label="Unpaid"
          value={<MoneyDisplay value={kpis.unpaidAmount} currency={currency} />}
          hint={`${kpis.unpaidCount} pending`}
          accent={kpis.unpaidCount > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Tax captured"
          value={<MoneyDisplay value={kpis.taxTotal} currency={currency} />}
          hint="Recoverable input tax"
          accent="success"
        />
      </div>

      <div className="mb-4 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, number, supplier…"
            className="h-9 max-w-xs"
          />
          <Input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
            className="h-9 w-auto"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
            className="h-9 w-auto"
          />
          <Select
            value={filters.account_id ?? "all"}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, account_id: v === "all" ? null : v }))
            }
          >
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {expenseAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.payment_method ?? "all"}
            onValueChange={(v) =>
              setFilters((f) => ({
                ...f,
                payment_method: v === "all" ? null : (v as QuickExpenseMethod),
              }))
            }
          >
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {(Object.keys(METHOD_LABEL) as QuickExpenseMethod[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {METHOD_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.paid ?? "all"}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, paid: v as QuickExpenseFilters["paid"] }))
            }
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
          {(branches?.length ?? 0) > 0 && (
            <Select
              value={filters.branch_id ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, branch_id: v === "all" ? null : v }))
              }
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches!.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ paid: "all" })}
              className="h-9"
            >
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3 w-3" />
            {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} · {filtered.length} rows
          </div>
        </div>
      </div>

      <DataTable<QuickExpenseListItem>
        loading={isLoading}
        data={filtered}
        onRowClick={(r) => {
          setEditId(r.id);
          setDrawerOpen(true);
        }}
        emptyState={
          <EmptyState
            icon={<Receipt className="h-5 w-5" />}
            title="No expenses match"
            description="Adjust filters or capture your first quick expense."
            action={
              <Button
                onClick={() => {
                  setEditId(null);
                  setDrawerOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> New expense
              </Button>
            }
          />
        }
        columns={[
          {
            key: "number",
            header: "Number",
            cell: (r) => <span className="font-mono text-xs">{r.expense_number}</span>,
          },
          { key: "date", header: "Date", cell: (r) => formatDate(r.date) },
          {
            key: "desc",
            header: "Description",
            cell: (r) => (
              <div className="min-w-0">
                <div className="truncate font-medium">{r.description}</div>
                {r.supplier_name && (
                  <div className="truncate text-xs text-muted-foreground">
                    {r.supplier_name}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "account",
            header: "Account",
            cell: (r) =>
              r.account_name ? (
                <span className="text-xs">
                  <span className="font-mono text-muted-foreground">{r.account_code}</span>{" "}
                  {r.account_name}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              ),
          },
          {
            key: "method",
            header: "Method",
            cell: (r) => (
              <Badge variant={r.paid ? "secondary" : "outline"} className="capitalize">
                {METHOD_LABEL[r.payment_method]}
              </Badge>
            ),
          },
          {
            key: "paid",
            header: "Status",
            cell: (r) =>
              r.paid ? (
                <Badge className="bg-success/15 text-success border-success/30">Paid</Badge>
              ) : (
                <Badge className="bg-warning/15 text-warning-foreground border-warning/40">
                  Unpaid
                </Badge>
              ),
          },
          {
            key: "tax",
            header: "Tax",
            align: "right",
            cell: (r) => <MoneyDisplay value={r.tax_amount} currency={r.currency} muted />,
          },
          {
            key: "amount",
            header: "Total",
            align: "right",
            cell: (r) => (
              <MoneyDisplay
                value={Number(r.amount) + Number(r.tax_amount ?? 0)}
                currency={r.currency}
                className="font-medium"
              />
            ),
          },
        ]}
        footer={
          <tr>
            <td
              colSpan={7}
              className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Total
            </td>
            <td className="px-3 py-2.5 text-right">
              <MoneyDisplay
                value={kpis.totalAmount}
                currency={currency}
                className="font-semibold"
              />
            </td>
          </tr>
        }
      />

      <QuickExpenseDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        expenseId={editId}
      />
    </div>
  );
}
