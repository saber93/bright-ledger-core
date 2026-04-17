import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { Button } from "@/components/ui/button";
import { ChevronRight, Truck, CheckCircle2, CreditCard, PackageCheck, XCircle, RotateCcw } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  useOnlineOrder,
  useUpdateOnlineOrderStatus,
  type OnlineOrderStatus,
} from "@/features/online-orders/hooks";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/store/$orderId")({
  component: OnlineOrderDetail,
});

interface Transition {
  status: OnlineOrderStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "outline" | "destructive";
}

const TRANSITIONS: Record<OnlineOrderStatus, Transition[]> = {
  pending: [
    { status: "paid", label: "Mark as paid", icon: CreditCard },
    { status: "cancelled", label: "Cancel order", icon: XCircle, variant: "outline" },
  ],
  paid: [
    { status: "fulfilled", label: "Mark as fulfilled", icon: PackageCheck },
    { status: "refunded", label: "Refund", icon: RotateCcw, variant: "outline" },
  ],
  fulfilled: [
    { status: "shipped", label: "Mark as shipped", icon: Truck },
    { status: "refunded", label: "Refund", icon: RotateCcw, variant: "outline" },
  ],
  shipped: [
    { status: "delivered", label: "Mark as delivered", icon: CheckCircle2 },
    { status: "refunded", label: "Refund", icon: RotateCcw, variant: "outline" },
  ],
  delivered: [
    { status: "refunded", label: "Refund", icon: RotateCcw, variant: "outline" },
  ],
  cancelled: [],
  refunded: [],
};

function OnlineOrderDetail() {
  const { orderId } = Route.useParams();
  const { data, isLoading } = useOnlineOrder(orderId);
  const updateStatus = useUpdateOnlineOrderStatus();

  if (isLoading) return <div className="py-10 text-sm text-muted-foreground">Loading…</div>;
  if (!data?.order) return <div className="py-10 text-sm text-muted-foreground">Order not found.</div>;

  const { order, lines } = data;
  const transitions = TRANSITIONS[order.status] ?? [];

  const handleTransition = (status: OnlineOrderStatus) => {
    updateStatus.mutate(
      { id: order.id, status },
      {
        onSuccess: () => toast.success(`Order ${order.order_number} marked as ${status}`),
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to update"),
      },
    );
  };

  const shippingAddress = [
    order.shipping_address_line1,
    [order.shipping_city, order.shipping_postal_code].filter(Boolean).join(" "),
    order.shipping_country,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div>
      <PageHeader
        title={order.order_number}
        description={`Placed ${formatDateTime(order.placed_at)}`}
        breadcrumbs={
          <span className="inline-flex items-center gap-1">
            <Link to="/store" className="hover:text-foreground">
              Online Store
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span>{order.order_number}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            {transitions.map((t) => {
              const Icon = t.icon;
              return (
                <Button
                  key={t.status}
                  size="sm"
                  variant={t.variant ?? "default"}
                  disabled={updateStatus.isPending}
                  onClick={() => handleTransition(t.status)}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </Button>
              );
            })}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Line items */}
        <div className="space-y-4 lg:col-span-2">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-5 py-3">
              <h3 className="text-sm font-semibold">Line items</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold">Unit</th>
                  <th className="px-5 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b last:border-b-0">
                    <td className="px-5 py-3 font-medium">{l.product_name}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{l.quantity}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">
                      <MoneyDisplay value={l.unit_price} currency={order.currency} muted />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <MoneyDisplay value={l.line_total} currency={order.currency} />
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      No line items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold">Order summary</h3>
            <dl className="space-y-2 text-sm">
              <SummaryRow label="Subtotal" value={order.subtotal} currency={order.currency} muted />
              <SummaryRow label="Shipping" value={order.shipping_total} currency={order.currency} muted />
              <SummaryRow label="Tax" value={order.tax_total} currency={order.currency} muted />
              <div className="my-2 h-px bg-border" />
              <SummaryRow label="Total" value={order.total} currency={order.currency} bold />
            </dl>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card title="Customer">
            <KV label="Name" value={order.customer_name} />
            <KV label="Email" value={order.customer_email} />
            <KV label="Phone" value={order.customer_phone} />
          </Card>

          <Card title="Shipping address">
            {shippingAddress ? (
              <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">{shippingAddress}</pre>
            ) : (
              <p className="text-sm text-muted-foreground">No shipping address.</p>
            )}
          </Card>

          <Card title="Payment">
            <KV label="Method" value={order.payment_method ?? "—"} />
            <KV label="Reference" value={order.payment_reference ?? "—"} mono />
            <KV label="Placed" value={formatDate(order.placed_at)} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs text-foreground" : "text-sm text-foreground"}>
        {value || "—"}
      </span>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  currency,
  muted,
  bold,
}: {
  label: string;
  value: number;
  currency: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-muted-foreground" : "text-foreground"}>{label}</dt>
      <dd>
        <MoneyDisplay
          value={value}
          currency={currency}
          muted={muted}
          className={bold ? "text-base font-semibold" : undefined}
        />
      </dd>
    </div>
  );
}
