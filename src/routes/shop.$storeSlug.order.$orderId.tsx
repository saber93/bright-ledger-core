import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, ChevronRight, CreditCard, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePortalOrder, useRetryStoreOrderPayment } from "@/features/storefront/hooks";
import { formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/shop/$storeSlug/order/$orderId")({
  validateSearch: (search: Record<string, unknown>) => ({
    payment:
      search.payment === "success" || search.payment === "cancelled"
        ? search.payment
        : null,
  }),
  component: StorefrontOrderPage,
});

function StorefrontOrderPage() {
  const { storeSlug, orderId } = Route.useParams();
  const { payment } = Route.useSearch();
  const query = usePortalOrder(storeSlug, orderId);
  const retryPayment = useRetryStoreOrderPayment();

  if (query.isLoading) {
    return <div className="py-16 text-sm text-muted-foreground">Loading order…</div>;
  }

  if (query.error || !query.data) {
    return (
      <div className="rounded-[32px] border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Order unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign into your customer account again to view this order.
        </p>
        <div className="mt-6">
          <Button asChild className="rounded-full px-6">
            <Link to="/shop/$storeSlug/account/access" params={{ storeSlug }}>
              Access account
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const { order } = query.data;
  const design = query.data.shell.design;

  return (
    <div className="space-y-8 pb-8">
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Order confirmed</AlertTitle>
        <AlertDescription>
          {order.paymentState === "paid"
            ? "Payment is recorded and your invoice is ready inside your customer account."
            : "Your order is in place and the outstanding balance will stay visible in your customer account."}
        </AlertDescription>
      </Alert>

      {payment === "cancelled" ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Payment was cancelled</AlertTitle>
          <AlertDescription>
            The order is still open. You can retry card payment below without creating a second order.
          </AlertDescription>
        </Alert>
      ) : null}

      {payment === "success" && order.paymentState !== "paid" ? (
        <Alert>
          <CreditCard className="h-4 w-4" />
          <AlertTitle>Payment is being confirmed</AlertTitle>
          <AlertDescription>
            Stripe has returned successfully and the final payment confirmation is being applied to the order.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Order</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{order.orderNumber}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Placed {formatDateTime(order.placedAt)} · {order.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/shop/$storeSlug/account" params={{ storeSlug }}>
              Go to account
            </Link>
          </Button>
          {order.invoice ? (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                window.location.href = `/api/storefront/account/document?storeSlug=${encodeURIComponent(storeSlug)}&documentType=invoice&documentId=${encodeURIComponent(order.invoice!.id)}`;
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Download invoice
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <section
          className="border bg-card p-6 shadow-sm"
          style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
        >
          <div className="text-lg font-semibold">Items</div>
          <div className="mt-6 space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 border-b border-border/60 pb-4 last:border-b-0 last:pb-0">
                <div>
                  {item.productKey ? (
                    <Link
                      to="/shop/$storeSlug/product/$productKey"
                      params={{ storeSlug, productKey: item.productKey }}
                      className="font-medium transition hover:text-primary"
                    >
                      {item.productName}
                    </Link>
                  ) : (
                    <div className="font-medium">{item.productName}</div>
                  )}
                  <div className="mt-1 text-sm text-muted-foreground">
                    Qty {item.quantity} · {formatMoney(item.unitPrice)}
                  </div>
                </div>
                <div className="font-medium">{formatMoney(item.lineTotal)}</div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div
            className="border bg-card p-6 shadow-sm"
            style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
          >
            <div className="text-lg font-semibold">Summary</div>
            <dl className="mt-5 space-y-3 text-sm">
              <SummaryRow label="Subtotal" value={formatMoney(order.subtotal)} />
              <SummaryRow label="Shipping" value={formatMoney(order.shippingTotal)} />
              <SummaryRow label="Tax" value={formatMoney(order.taxTotal)} />
              <div className="h-px bg-border" />
              <SummaryRow label="Total" value={formatMoney(order.total)} strong />
            </dl>
          </div>

          <div
            className="border bg-card p-6 shadow-sm"
            style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
          >
            <div className="text-lg font-semibold">Next step</div>
            <div className="mt-4 text-sm text-muted-foreground">
              {order.paymentState === "paid"
                ? "Your order is paid and ready for fulfillment updates."
                : order.fulfillmentType === "pickup"
                  ? "Your order is ready for payment follow-up, and pickup details stay visible once payment settles."
                  : "Your invoice remains available in the account area, with payment and statement visibility in one place."}
            </div>
            {order.shippingMethodLabel ? (
              <div className="mt-4 text-sm text-muted-foreground">
                Fulfillment: {order.shippingMethodLabel}
                {order.shippingEta ? ` · ${order.shippingEta}` : ""}
              </div>
            ) : null}
            <div className="mt-5">
              <div className="flex flex-wrap gap-3">
                <Button variant={design.commerce.accountStyle === "list" ? "default" : "outline"} className="rounded-full" asChild>
                  <Link to="/shop/$storeSlug/account" params={{ storeSlug }}>
                    Open account
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {order.canRetryPayment ? (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    disabled={retryPayment.isPending}
                    onClick={async () => {
                      try {
                        const result = await retryPayment.mutateAsync({ storeSlug, orderId });
                        if (result.redirectUrl) {
                          window.location.href = result.redirectUrl;
                          return;
                        }
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Retry failed");
                      }
                    }}
                  >
                    Retry payment
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt>{label}</dt>
      <dd className={strong ? "font-semibold" : undefined}>{value}</dd>
    </div>
  );
}
