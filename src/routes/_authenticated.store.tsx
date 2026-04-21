import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { ShoppingBag } from "lucide-react";
import { useModuleEnabled } from "@/components/data/ModuleGate";
import { useOnlineOrders, type OnlineOrderStatus } from "@/features/online-orders/hooks";
import { DataTable } from "@/components/data/DataTable";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useStoreSetup } from "@/features/storefront/hooks";

const STATUS_FILTERS: (OnlineOrderStatus | "all")[] = [
  "all",
  "pending",
  "paid",
  "fulfilled",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export const Route = createFileRoute("/_authenticated/store")({
  component: StorePage,
});

function StorePage() {
  const location = useLocation();
  const isStoreIndex = location.pathname === "/store";
  const enabled = useModuleEnabled("online_store_enabled");
  const { data, isLoading } = useOnlineOrders(isStoreIndex);
  const { companyId } = useAuth();
  const setup = useStoreSetup(isStoreIndex ? companyId : null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OnlineOrderStatus | "all">("all");

  const filtered = useMemo(() => {
    return (data ?? []).filter((o) => {
      const matchesSearch =
        !search ||
        o.order_number.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_email.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  if (!isStoreIndex) {
    return <Outlet />;
  }

  if (!enabled) {
    return (
      <div>
        <PageHeader title="Online Store" description="Publish products and manage online orders." />
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Online Store is disabled"
          description="Enable Online Store from Settings → Modules to publish your catalog."
        />
      </div>
    );
  }

  const totalSum = filtered.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div>
      <PageHeader
        title="Online Store"
        description="Manage online orders, fulfillment, and shipping."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/store/setup">Store setup</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/store/design">Store design</Link>
            </Button>
            {setup.data?.storeUrl ? (
              <Button variant="outline" asChild>
                <a href={setup.data.storeUrl}>Preview storefront</a>
              </Button>
            ) : null}
          </div>
        }
      />

      {setup.data ? (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Store URL</div>
            <div className="mt-2 font-medium">{setup.data.storeUrl}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Published products</div>
            <div className="mt-2 text-2xl font-semibold">
              {setup.data.products.filter((product) => product.isPublished).length}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Checkout mode</div>
            <div className="mt-2 font-medium">
              {setup.data.settings.onlinePaymentsEnabled ? "Online payment + invoice fallback" : "Invoice-first"}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order #, customer, or email…"
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
            icon={<ShoppingBag className="h-5 w-5" />}
            title="No online orders match"
            description="Try a different filter or search term."
          />
        }
        columns={[
          {
            key: "number",
            header: "Order",
            cell: (r) => (
              <Link
                to="/store/$orderId"
                params={{ orderId: r.id }}
                className="font-mono text-xs font-medium text-primary hover:underline"
              >
                {r.order_number}
              </Link>
            ),
          },
          {
            key: "customer",
            header: "Customer",
            cell: (r) => (
              <div className="min-w-0">
                <div className="truncate font-medium">{r.customer_name}</div>
                <div className="truncate text-xs text-muted-foreground">{r.customer_email}</div>
              </div>
            ),
          },
          {
            key: "ship_to",
            header: "Ship to",
            cell: (r) => (
              <span className="text-xs text-muted-foreground">
                {[r.shipping_city, r.shipping_country].filter(Boolean).join(", ") || "—"}
              </span>
            ),
          },
          { key: "placed", header: "Placed", cell: (r) => formatDate(r.placed_at) },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          {
            key: "total",
            header: "Total",
            align: "right",
            cell: (r) => <MoneyDisplay value={r.total} currency={r.currency} />,
          },
        ]}
        footer={
          <tr>
            <td
              colSpan={5}
              className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Total
            </td>
            <td className="px-3 py-2.5 text-right">
              <MoneyDisplay
                value={totalSum}
                currency={filtered[0]?.currency ?? "USD"}
                className="font-semibold"
              />
            </td>
          </tr>
        }
      />
    </div>
  );
}
