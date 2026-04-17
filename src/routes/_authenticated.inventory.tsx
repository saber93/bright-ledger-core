import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { Package, AlertTriangle } from "lucide-react";
import { useModuleEnabled } from "@/components/data/ModuleGate";
import { DataTable } from "@/components/data/DataTable";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { MetricCard } from "@/components/data/MetricCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProductsWithStock, useWarehouses } from "@/features/inventory/hooks";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  const enabled = useModuleEnabled("inventory_enabled");
  const { data: products, isLoading } = useProductsWithStock();
  const { data: warehouses } = useWarehouses();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "published">("all");

  const filtered = useMemo(() => {
    return (products ?? []).filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        (p.category_name?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesFilter =
        filter === "all" ||
        (filter === "low" && p.is_low_stock) ||
        (filter === "published" && p.is_published);
      return matchesSearch && matchesFilter;
    });
  }, [products, search, filter]);

  if (!enabled) {
    return (
      <div>
        <PageHeader title="Products & Inventory" description="Manage products, warehouses, and stock." />
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="Inventory is disabled"
          description="Enable the Inventory module from Settings → Modules to start tracking products."
        />
      </div>
    );
  }

  const all = products ?? [];
  const lowStockCount = all.filter((p) => p.is_low_stock).length;
  const totalSkus = all.length;
  const totalUnits = all.reduce((s, p) => s + p.total_stock, 0);
  const inventoryValue = all.reduce((s, p) => s + p.total_stock * Number(p.cost_price), 0);

  return (
    <div>
      <PageHeader title="Products & Inventory" description="Track stock across warehouses and watch reorder points." />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active SKUs" value={totalSkus.toString()} />
        <MetricCard label="Units on hand" value={totalUnits.toLocaleString()} />
        <MetricCard
          label="Inventory value"
          value={<MoneyDisplay value={inventoryValue} />}
        />
        <MetricCard
          label="Low stock"
          value={lowStockCount.toString()}
          tone={lowStockCount > 0 ? "danger" : "default"}
          icon={lowStockCount > 0 ? <AlertTriangle className="h-4 w-4" /> : undefined}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU, or category…"
          className="max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-1">
          {(["all", "low", "published"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="h-7 capitalize"
            >
              {f === "low" ? "Low stock" : f}
            </Button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {totalSkus} products · {warehouses?.length ?? 0} warehouses
        </span>
      </div>

      <DataTable
        loading={isLoading}
        data={filtered}
        emptyState={
          <EmptyState
            icon={<Package className="h-5 w-5" />}
            title="No products match"
            description="Adjust your search or filter to see more results."
          />
        }
        columns={[
          {
            key: "product",
            header: "Product",
            cell: (p) => (
              <div className="min-w-0">
                <Link
                  to="/inventory/$productId"
                  params={{ productId: p.id }}
                  className="font-medium text-foreground hover:text-primary hover:underline"
                >
                  {p.name}
                </Link>
                <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
              </div>
            ),
          },
          {
            key: "category",
            header: "Category",
            cell: (p) => (
              <span className="text-xs text-muted-foreground">{p.category_name ?? "—"}</span>
            ),
          },
          {
            key: "type",
            header: "Type",
            cell: (p) => <span className="text-xs capitalize text-muted-foreground">{p.type}</span>,
          },
          {
            key: "stock",
            header: "Stock by warehouse",
            cell: (p) =>
              p.type !== "goods" ? (
                <span className="text-xs text-muted-foreground">Not tracked</span>
              ) : p.stock_by_warehouse.length === 0 ? (
                <span className="text-xs text-muted-foreground">No stock</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {p.stock_by_warehouse.map((s) => (
                    <span
                      key={s.warehouse_id}
                      className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs"
                    >
                      <span className="text-muted-foreground">{s.warehouse_name}:</span>
                      <span className="font-medium">{s.quantity}</span>
                    </span>
                  ))}
                </div>
              ),
          },
          {
            key: "total",
            header: "Total",
            align: "right",
            cell: (p) =>
              p.type !== "goods" ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                <div className="flex items-center justify-end gap-2">
                  <span className={cn("font-medium tabular-nums", p.is_low_stock && "text-destructive")}>
                    {p.total_stock} {p.unit}
                  </span>
                  {p.is_low_stock && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      Low
                    </span>
                  )}
                </div>
              ),
          },
          {
            key: "price",
            header: "Sale price",
            align: "right",
            cell: (p) => <MoneyDisplay value={p.sale_price} />,
          },
        ]}
      />
    </div>
  );
}
