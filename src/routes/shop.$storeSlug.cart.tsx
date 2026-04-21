import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/features/storefront/cart";
import { useStoreShell } from "@/features/storefront/hooks";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/shop/$storeSlug/cart")({
  component: StorefrontCartPage,
});

function StorefrontCartPage() {
  const { storeSlug } = Route.useParams();
  const cart = useCart();
  const navigate = useNavigate();
  const shell = useStoreShell(storeSlug);
  const design = shell.data?.design;

  if (cart.items.length === 0) {
    return (
      <div className="rounded-[32px] border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Your cart is empty</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Add a few products first and we’ll keep checkout simple from there.
        </p>
        <div className="mt-6">
          <Button asChild className="rounded-full px-6">
            <Link to="/shop/$storeSlug" params={{ storeSlug }}>
              Continue shopping
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid gap-8 ${design?.commerce.cartSummaryStyle === "split" ? "lg:grid-cols-[1fr,1fr]" : "lg:grid-cols-[1.2fr,0.8fr]"}`}>
      <section className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Cart</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Review your order</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Adjust quantities, confirm stock-aware totals, then move into checkout.
          </p>
        </div>

        <div className="space-y-4">
          {cart.items.map((item) => (
            <div
              key={item.productId}
              data-testid={`cart-item-${item.productId}`}
              className="grid gap-4 rounded-[28px] border border-border/70 bg-card p-4 shadow-sm sm:grid-cols-[120px,1fr,auto]"
            >
              <Link
                to="/shop/$storeSlug/product/$productKey"
                params={{ storeSlug, productKey: item.productKey }}
                className="block overflow-hidden rounded-2xl bg-muted/40"
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="aspect-square h-full w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-xs text-muted-foreground">
                    {item.name}
                  </div>
                )}
              </Link>

              <div className="space-y-2">
                <Link
                  to="/shop/$storeSlug/product/$productKey"
                  params={{ storeSlug, productKey: item.productKey }}
                  className="text-lg font-semibold tracking-tight transition hover:text-primary"
                >
                  {item.name}
                </Link>
                <div className="text-sm text-muted-foreground">
                  {formatMoney(item.price)} each · {item.taxRate}% tax
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    aria-label={`Decrease quantity for ${item.name}`}
                    onClick={() => cart.updateQuantity(item.productId, item.quantity - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span
                    data-testid={`cart-item-quantity-${item.productId}`}
                    className="min-w-[2ch] text-center text-sm font-medium"
                  >
                    {item.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    aria-label={`Increase quantity for ${item.name}`}
                    onClick={() => cart.updateQuantity(item.productId, item.quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col items-end justify-between gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-muted-foreground"
                  aria-label={`Remove ${item.name} from cart`}
                  onClick={() => cart.removeItem(item.productId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Line total</div>
                  <div className="mt-1 text-lg font-semibold">
                    {formatMoney(item.price * item.quantity * (1 + item.taxRate / 100))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <div
          className="border bg-card p-6 shadow-sm"
          style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
        >
          <div className="text-sm font-semibold">Order summary</div>
          <dl className="mt-5 space-y-3 text-sm">
            <SummaryRow label="Subtotal" value={formatMoney(cart.subtotal)} />
            <SummaryRow label="Estimated tax" value={formatMoney(cart.taxTotal)} muted />
            <SummaryRow label="Shipping" value="Calculated in checkout" muted />
            <div className="h-px bg-border" />
            <SummaryRow label="Estimated total" value={formatMoney(cart.total)} strong />
          </dl>

          <div className="mt-6 space-y-3">
            <Button
              className="h-11 w-full rounded-full"
              onClick={() => navigate({ to: "/shop/$storeSlug/checkout", params: { storeSlug } })}
            >
              Proceed to checkout
            </Button>
            <Button variant="outline" className="h-11 w-full rounded-full" asChild>
              <Link to="/shop/$storeSlug" params={{ storeSlug }}>
                Continue shopping
              </Link>
            </Button>
          </div>
        </div>

        <div
          className="border bg-card/70 p-5 text-sm text-muted-foreground"
          style={{ borderRadius: "var(--store-radius-soft)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
        >
          Taxes are shown transparently from the product records, and final invoices stay aligned with the same ERP/customer balance workflow.
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={muted ? "text-muted-foreground" : undefined}>{label}</dt>
      <dd className={strong ? "font-semibold" : undefined}>{value}</dd>
    </div>
  );
}
