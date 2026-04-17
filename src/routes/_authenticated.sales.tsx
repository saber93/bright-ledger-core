import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { ClipboardList } from "lucide-react";
import { DataTable } from "@/components/data/DataTable";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { MetricCard } from "@/components/data/MetricCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useSalesOrders, type SalesOrderStatus } from "@/features/sales-orders/hooks";

const STATUS_FILTERS: (SalesOrderStatus | "all")[] = [
  "all",
  "draft",
  "quotation",
  "confirmed",
  "fulfilled",
  "invoiced",
  "cancelled",
];

export const Route = createFileRoute("/_authenticated/sales")({
  component: SalesOrdersPage,
});

function SalesOrdersPage() {
  const { data, isLoading } = useSalesOrders();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | "all">("all");

  const filtered = useMemo(() => {
    return (data ?? []).filter((o) => {
      const matchesSearch =
        !search ||
        o.order_number.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  const all = data ?? [];
  const openCount = all.filter((o) => ["quotation", "confirmed"].includes(o.status)).length;
  const fulfilledCount = all.filter((o) => o.status === "fulfilled").length;
  const invoicedValue = all
    .filter((o) => o.status === "invoiced")
    .reduce((s, o) => s + Number(o.total), 0);
  const pipelineValue = all
    .filter((o) => ["quotation", "confirmed", "fulfilled"].includes(o.status))
    .reduce((s, o) => s + Number(o.total), 0);

  return (
    <div>
      <PageHeader title="Sales Orders" description="Quotations, confirmed orders, fulfillment, and invoicing." />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Open orders" value={openCount.toString()} />
        <MetricCard label="Awaiting invoice" value={fulfilledCount.toString()} />
        <MetricCard label="Pipeline value" value={<MoneyDisplay value={pipelineValue} />} />
        <MetricCard label="Invoiced value" value={<MoneyDisplay value={invoicedValue} />} accent="success" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order # or customer…"
          className="max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-1">
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
              className="h-7 capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} orders</span>
      </div>

      <DataTable
        loading={isLoading}
        data={filtered}
        emptyState={
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No sales orders match"
            description="Try a different status or search term."
          />
        }
        columns={[
          {
            key: "number",
            header: "Order",
            cell: (r) => (
              <Link
                to="/sales/$orderId"
                params={{ orderId: r.id }}
                className="font-mono text-xs font-medium text-primary hover:underline"
              >
                {r.order_number}
              </Link>
            ),
          },
          { key: "customer", header: "Customer", cell: (r) => r.customer_name },
          { key: "date", header: "Order date", cell: (r) => formatDate(r.order_date) },
          {
            key: "delivery",
            header: "Expected delivery",
            cell: (r) => (
              <span className="text-xs text-muted-foreground">
                {formatDate(r.expected_delivery_date)}
              </span>
            ),
          },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          {
            key: "total",
            header: "Total",
            align: "right",
            cell: (r) => <MoneyDisplay value={r.total} currency={r.currency} />,
          },
        ]}
      />
    </div>
  );
}
