import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Repeat, Wrench } from "lucide-react";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { MetricCard } from "@/components/data/MetricCard";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { DataTable } from "@/components/data/DataTable";
import { ActivityTimeline, type TimelineItem } from "@/components/data/ActivityTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useProduct, type StockMovementType } from "@/features/inventory/hooks";

export const Route = createFileRoute("/_authenticated/inventory/$productId")({
  component: ProductDetailPage,
});

const movementMeta: Record<StockMovementType, { label: string; icon: typeof ArrowDownToLine; tone: string }> = {
  in: { label: "Stock in", icon: ArrowDownToLine, tone: "text-success" },
  out: { label: "Stock out", icon: ArrowUpFromLine, tone: "text-destructive" },
  transfer: { label: "Transfer", icon: Repeat, tone: "text-info" },
  adjustment: { label: "Adjustment", icon: Wrench, tone: "text-warning-foreground" },
};

function ProductDetailPage() {
  const { productId } = Route.useParams();
  const { data, isLoading } = useProduct(productId);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Loading…" />
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading product…
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Product not found" />
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="Product not found"
          description="It may have been deleted or you don't have access."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/inventory">
                <ArrowLeft className="h-4 w-4" />
                Back to inventory
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { product, category_name, levels, movements, total_stock, is_low_stock } = data;
  const tracksStock = product.type === "goods";
  const margin =
    Number(product.sale_price) > 0
      ? ((Number(product.sale_price) - Number(product.cost_price)) / Number(product.sale_price)) * 100
      : 0;

  const timelineItems: TimelineItem[] = movements.map((m) => {
    const meta = movementMeta[m.type];
    const Icon = meta.icon;
    const signed = m.type === "out" ? -Math.abs(m.quantity) : m.quantity;
    return {
      id: m.id,
      icon: <Icon className={cn("h-4 w-4", meta.tone)} />,
      title: (
        <span className="flex items-center gap-2">
          <span>{meta.label}</span>
          <span className={cn("font-mono text-sm font-semibold tabular-nums", meta.tone)}>
            {signed > 0 ? "+" : ""}
            {signed} {product.unit}
          </span>
          <span className="text-xs font-normal text-muted-foreground">@ {m.warehouse_name}</span>
        </span>
      ),
      description: m.notes || m.reference || undefined,
      timestamp: m.occurred_at,
    };
  });

  return (
    <div>
      <PageHeader
        title={product.name}
        description={
          <span className="font-mono text-xs text-muted-foreground">
            {product.sku} · {category_name ?? "Uncategorized"} · {product.type}
          </span>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/inventory">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="On hand"
          value={tracksStock ? `${total_stock} ${product.unit}` : "Not tracked"}
          tone={is_low_stock ? "danger" : "default"}
          icon={is_low_stock ? <AlertTriangle className="h-4 w-4" /> : undefined}
        />
        <MetricCard label="Reorder point" value={`${Number(product.reorder_point)} ${product.unit}`} />
        <MetricCard label="Sale price" value={<MoneyDisplay value={product.sale_price} />} />
        <MetricCard
          label="Margin"
          value={`${margin.toFixed(1)}%`}
          hint={
            <span className="text-xs text-muted-foreground">
              Cost <MoneyDisplay value={product.cost_price} className="text-xs" />
            </span>
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Tabs defaultValue="stock">
            <TabsList>
              <TabsTrigger value="stock">Stock by warehouse</TabsTrigger>
              <TabsTrigger value="movements">Movements ({movements.length})</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="stock" className="mt-3">
              {!tracksStock ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Stock is not tracked for {product.type} products.
                  </CardContent>
                </Card>
              ) : (
                <DataTable
                  data={levels}
                  emptyState={
                    <EmptyState
                      icon={<Package className="h-5 w-5" />}
                      title="No stock recorded"
                      description="Receive stock or create an adjustment to set quantities."
                    />
                  }
                  columns={[
                    { key: "wh", header: "Warehouse", cell: (l) => l.warehouse_name },
                    {
                      key: "qty",
                      header: "Quantity",
                      align: "right",
                      cell: (l) => (
                        <span className="font-medium tabular-nums">
                          {l.quantity} {product.unit}
                        </span>
                      ),
                    },
                    {
                      key: "value",
                      header: "Value (at cost)",
                      align: "right",
                      cell: (l) => <MoneyDisplay value={l.quantity * Number(product.cost_price)} />,
                    },
                  ]}
                />
              )}
            </TabsContent>

            <TabsContent value="movements" className="mt-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Stock movements</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActivityTimeline items={timelineItems} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="mt-3">
              <Card>
                <CardContent className="grid gap-3 py-5 text-sm sm:grid-cols-2">
                  <DetailRow label="SKU" value={<span className="font-mono">{product.sku}</span>} />
                  <DetailRow label="Barcode" value={product.barcode ?? "—"} />
                  <DetailRow label="Type" value={<span className="capitalize">{product.type}</span>} />
                  <DetailRow label="Unit" value={product.unit} />
                  <DetailRow label="Tax rate" value={`${Number(product.tax_rate)}%`} />
                  <DetailRow
                    label="Status"
                    value={
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Pill active={product.is_active} on="Active" off="Inactive" />
                        <Pill active={product.is_published} on="Published" off="Unpublished" />
                      </span>
                    }
                  />
                  {product.description && (
                    <div className="sm:col-span-2">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Description
                      </div>
                      <p className="mt-1 text-sm text-foreground">{product.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Cost price">
                <MoneyDisplay value={product.cost_price} />
              </Row>
              <Row label="Sale price">
                <MoneyDisplay value={product.sale_price} className="font-semibold" />
              </Row>
              <Row label="Tax rate">{Number(product.tax_rate)}%</Row>
              <Row label="Margin">{margin.toFixed(1)}%</Row>
            </CardContent>
          </Card>

          {tracksStock && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stock summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Total on hand">
                  <span className={cn("font-medium tabular-nums", is_low_stock && "text-destructive")}>
                    {total_stock} {product.unit}
                  </span>
                </Row>
                <Row label="Reorder point">
                  {Number(product.reorder_point)} {product.unit}
                </Row>
                <Row label="Inventory value">
                  <MoneyDisplay value={total_stock * Number(product.cost_price)} />
                </Row>
                <Row label="Locations">{levels.length}</Row>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm text-foreground">{value}</div>
    </div>
  );
}

function Pill({ active, on, off }: { active: boolean; on: string; off: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        active
          ? "border-success/30 bg-success/10 text-success"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {active ? on : off}
    </span>
  );
}
