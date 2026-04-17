import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Undo2, Plus, Filter } from "lucide-react";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { DataTable } from "@/components/data/DataTable";
import { MetricCard } from "@/components/data/MetricCard";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompanySettings } from "@/features/settings/hooks";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { useCreditNotes, type CreditNoteListItem } from "@/features/refunds/hooks";
import { CreateRefundDialog } from "@/components/refunds/CreateRefundDialog";

export const Route = createFileRoute("/_authenticated/refunds")({
  component: RefundsPage,
});

function RefundsPage() {
  const { data: settings } = useCompanySettings();
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";

  const { data: rows, isLoading } = useCreditNotes();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = rows ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.credit_note_number.toLowerCase().includes(q) ||
          (r.customer_name ?? "").toLowerCase().includes(q) ||
          (r.source_label ?? "").toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (sourceFilter !== "all") list = list.filter((r) => r.source_type === sourceFilter);
    return list;
  }, [rows, search, statusFilter, sourceFilter]);

  const kpis = useMemo(() => {
    const list = filtered;
    const totalRefunded = list.reduce((s, r) => s + Number(r.total), 0);
    const totalAllocated = list.reduce((s, r) => s + Number(r.amount_allocated), 0);
    return {
      count: list.length,
      totalRefunded,
      totalAllocated,
    };
  }, [filtered]);

  if (settings && !settings.refunds_enabled) {
    return (
      <div>
        <PageHeader title="Refunds" description="Module disabled" />
        <EmptyState
          icon={<Undo2 className="h-8 w-8" />}
          title="Refunds are disabled"
          description="Enable Refunds & Credit Notes in Settings → Modules & Features to start issuing refunds."
          action={
            <Button asChild variant="outline">
              <Link to="/settings/modules">Open module settings</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Refunds & Credit Notes"
        description="Issue refunds against invoices or POS orders. Allocate to invoice balance, customer credit, or cash refund."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New refund
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Credit notes"
          value={kpis.count}
          hint={statusFilter === "all" ? "All statuses" : `Status: ${statusFilter}`}
          icon={<Undo2 className="h-5 w-5" />}
          accent="primary"
        />
        <MetricCard
          label="Total refunded"
          value={<MoneyDisplay value={kpis.totalRefunded} currency={currency} />}
          hint="Issued credit value"
          accent="info"
        />
        <MetricCard
          label="Allocated"
          value={<MoneyDisplay value={kpis.totalAllocated} currency={currency} />}
          hint="Settled to invoices, credit, or cash"
          accent="success"
        />
      </div>

      <div className="mb-4 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number, customer, source…"
            className="h-9 max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="partially_settled">Partially settled</SelectItem>
              <SelectItem value="settled">Settled</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
              <SelectItem value="pos">POS order</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3 w-3" /> {filtered.length} rows
          </div>
        </div>
      </div>

      <DataTable<CreditNoteListItem>
        loading={isLoading}
        data={filtered}
        onRowClick={(r) => {
          window.location.href = `/refunds/${r.id}`;
        }}
        emptyState={
          <EmptyState
            icon={<Undo2 className="h-5 w-5" />}
            title="No refunds yet"
            description="Issue your first refund against an invoice or POS order."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New refund
              </Button>
            }
          />
        }
        columns={[
          {
            key: "num",
            header: "Number",
            cell: (r) => <span className="font-mono text-xs">{r.credit_note_number}</span>,
          },
          { key: "date", header: "Issued", cell: (r) => formatDate(r.issue_date) },
          {
            key: "source",
            header: "Source",
            cell: (r) =>
              r.source_label ? (
                <span className="text-xs">
                  <span className="capitalize text-muted-foreground">{r.source_type}</span>{" "}
                  · <span className="font-mono">{r.source_label}</span>
                </span>
              ) : (
                <span className="text-xs capitalize text-muted-foreground">{r.source_type}</span>
              ),
          },
          { key: "cust", header: "Customer", cell: (r) => r.customer_name ?? "—" },
          {
            key: "reason",
            header: "Reason",
            cell: (r) => (
              <span className="line-clamp-1 max-w-[280px] text-xs text-muted-foreground">
                {r.reason ?? "—"}
              </span>
            ),
          },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          {
            key: "alloc",
            header: "Allocated",
            align: "right",
            cell: (r) => (
              <MoneyDisplay value={r.amount_allocated} currency={r.currency} muted />
            ),
          },
          {
            key: "total",
            header: "Total",
            align: "right",
            cell: (r) => (
              <MoneyDisplay
                value={r.total}
                currency={r.currency}
                className="font-medium"
              />
            ),
          },
        ]}
      />

      <CreateRefundDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
