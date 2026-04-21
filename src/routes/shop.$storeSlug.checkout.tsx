import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { cloneElement, isValidElement, useEffect, useId, useMemo, useState } from "react";
import { AlertCircle, CreditCard, ReceiptText, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCart } from "@/features/storefront/cart";
import { useStoreCheckout, useStoreCheckoutContext, useStoreShell } from "@/features/storefront/hooks";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/shop/$storeSlug/checkout")({
  component: StorefrontCheckoutPage,
});

function StorefrontCheckoutPage() {
  const { storeSlug } = Route.useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const shell = useStoreShell(storeSlug);
  const checkout = useStoreCheckout();
  const checkoutContext = useStoreCheckoutContext();
  const { data: checkoutContextData, mutateAsync: loadCheckoutContext } = checkoutContext;
  const checkoutItems = useMemo(
    () =>
      cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    [cart.items],
  );

  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    addressLine1: "",
    city: "",
    postalCode: "",
    country: "",
  });
  const [notes, setNotes] = useState("");
  const [paymentOption, setPaymentOption] = useState<"pay_now" | "pay_later">("pay_now");
  const [shippingMethodCode, setShippingMethodCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (checkoutItems.length === 0) return;

    let active = true;
    void loadCheckoutContext({
        storeSlug,
        items: checkoutItems,
      })
      .then(() => {
        if (active) {
          setError((current) => (current === "Failed to load shipping methods." ? null : current));
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load shipping methods.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [checkoutItems, loadCheckoutContext, storeSlug]);

  const shippingMethods = useMemo(
    () => checkoutContextData?.availableShippingMethods ?? [],
    [checkoutContextData?.availableShippingMethods],
  );

  useEffect(() => {
    if (!shippingMethods.length) return;
    if (!shippingMethodCode || !shippingMethods.some((method) => method.code === shippingMethodCode)) {
      setShippingMethodCode(shippingMethods[0].code);
    }
  }, [shippingMethodCode, shippingMethods]);

  if (cart.items.length === 0) {
    return (
      <div className="rounded-[32px] border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Your cart is empty</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Add products before starting checkout.
        </p>
        <div className="mt-6">
          <Button asChild className="rounded-full px-6">
            <Link to="/shop/$storeSlug" params={{ storeSlug }}>
              Return to storefront
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const canPayNow = shell.data?.onlinePaymentsEnabled ?? false;
  const design = shell.data?.design;
  const selectedShippingMethod =
    shippingMethods.find((method) => method.code === shippingMethodCode) ?? shippingMethods[0] ?? null;
  const grandTotal = cart.subtotal + cart.taxTotal + (selectedShippingMethod?.effectiveAmount ?? 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const result = await checkout.mutateAsync({
        storeSlug,
        contact,
        items: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        paymentOption,
        shippingMethodCode,
        notes: notes.trim() || null,
      });
      cart.clear();
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      navigate({
        to: "/shop/$storeSlug/order/$orderId",
        params: { storeSlug, orderId: result.orderId },
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Checkout failed.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1.12fr,0.88fr]">
      <section className="space-y-6">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Checkout</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Keep it simple, keep it clear</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            One clean flow: fulfillment, contact, payment, then a traceable order, invoice, and customer account.
          </p>
        </div>

        <div className="flex gap-2">
          {["Fulfillment", "Payment", "Review"].map((step, index) => (
            <div
              key={step}
              className="flex-1 px-3 py-2 text-center text-xs font-medium"
              style={
                design?.commerce.checkoutProgressStyle === "bar"
                  ? {
                      borderRadius: "10px",
                      background:
                        index === 0 ? "var(--store-primary)" : "rgba(var(--store-primary-rgb), 0.08)",
                      color: index === 0 ? "#ffffff" : "var(--store-primary)",
                    }
                  : {
                      borderRadius: "999px",
                      background:
                        index === 0 ? "var(--store-primary)" : "rgba(var(--store-primary-rgb), 0.08)",
                      color: index === 0 ? "#ffffff" : "var(--store-primary)",
                    }
              }
            >
              {step}
            </div>
          ))}
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Checkout couldn’t finish</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div
          className="border bg-card p-6 shadow-sm"
          style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
        >
          <div className="mb-5 text-lg font-semibold">Fulfillment</div>
          <div className="grid gap-3 md:grid-cols-2">
            {shippingMethods.map((method) => (
              <button
                key={method.code}
                type="button"
                className={`rounded-[24px] border p-4 text-left transition ${
                  shippingMethodCode === method.code
                    ? "border-primary bg-primary/5"
                    : "border-border/70 bg-background"
                }`}
                onClick={() => setShippingMethodCode(method.code)}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Truck className="h-4 w-4" />
                  {method.label}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {method.description ?? "Configured storefront shipping or pickup option"}
                </p>
                <div className="mt-3 text-xs text-muted-foreground">
                  {method.etaLabel ?? "ETA set by merchant"} · {formatMoney(method.effectiveAmount)}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div
          className="border bg-card p-6 shadow-sm"
          style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
        >
          <div className="mb-5 text-lg font-semibold">Contact</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input
                required
                value={contact.name}
                onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))}
              />
            </Field>
            <Field label="Email">
              <Input
                required
                type="email"
                value={contact.email}
                onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={contact.phone}
                onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))}
              />
            </Field>
            <Field label="Country">
              <Input
                required
                value={contact.country}
                onChange={(event) => setContact((current) => ({ ...current, country: event.target.value }))}
              />
            </Field>
            <Field label="Address line 1" className="sm:col-span-2">
              <Input
                required
                value={contact.addressLine1}
                onChange={(event) =>
                  setContact((current) => ({ ...current, addressLine1: event.target.value }))
                }
              />
            </Field>
            <Field label="City">
              <Input
                required
                value={contact.city}
                onChange={(event) => setContact((current) => ({ ...current, city: event.target.value }))}
              />
            </Field>
            <Field label="Postal code">
              <Input
                required
                value={contact.postalCode}
                onChange={(event) =>
                  setContact((current) => ({ ...current, postalCode: event.target.value }))
                }
              />
            </Field>
            <Field label="Order notes" className="sm:col-span-2">
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
            </Field>
          </div>
        </div>

        <div
          className="border bg-card p-6 shadow-sm"
          style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
        >
          <div className="mb-5 text-lg font-semibold">Payment</div>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              className={`rounded-[24px] border p-5 text-left transition ${
                paymentOption === "pay_now"
                  ? "border-primary bg-primary/5"
                  : "border-border/70 bg-background"
              }`}
              onClick={() => setPaymentOption("pay_now")}
              disabled={!canPayNow}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CreditCard className="h-4 w-4" /> Pay online now
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Stripe-hosted checkout with webhook-confirmed payment posting back into the same order and invoice.
              </p>
              <div className="mt-3 text-xs text-muted-foreground">
                {shell.data?.paymentProvider.label ?? "Online payment provider"}
              </div>
              {!canPayNow ? (
                <div className="mt-3 text-xs text-warning-foreground">
                  This merchant has not enabled online payments or the PSP runtime yet.
                </div>
              ) : null}
            </button>

            <button
              type="button"
              className={`rounded-[24px] border p-5 text-left transition ${
                paymentOption === "pay_later"
                  ? "border-primary bg-primary/5"
                  : "border-border/70 bg-background"
              }`}
              onClick={() => setPaymentOption("pay_later")}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ReceiptText className="h-4 w-4" /> Send me an invoice
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Creates the order and invoice cleanly, then keeps collections and statement visibility in sync.
              </p>
            </button>
          </div>

          <div className="mt-5 rounded-[24px] border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            The customer account stays linked either way. If payment remains open, the order, invoice, and reminder flow stay connected instead of splitting into a second checkout path.
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div
          className="border bg-card p-6 shadow-sm"
          style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
        >
          <div className="text-lg font-semibold">Review</div>
          <div className="mt-5 space-y-3">
            {cart.items.map((item) => (
              <div key={item.productId} className="flex items-start justify-between gap-4 text-sm">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-muted-foreground">
                    Qty {item.quantity} · {formatMoney(item.price)}
                  </div>
                </div>
                <div className="font-medium">
                  {formatMoney(item.price * item.quantity * (1 + item.taxRate / 100))}
                </div>
              </div>
            ))}
          </div>

          <dl className="mt-6 space-y-3 border-t border-border/70 pt-5 text-sm">
            <SummaryRow label="Subtotal" value={formatMoney(cart.subtotal)} />
            <SummaryRow label="Tax" value={formatMoney(cart.taxTotal)} />
            <SummaryRow
              label={selectedShippingMethod?.label ?? "Shipping"}
              value={
                selectedShippingMethod
                  ? formatMoney(selectedShippingMethod.effectiveAmount)
                  : "Select a method"
              }
              muted={!selectedShippingMethod}
            />
            <SummaryRow
              label="ETA"
              value={selectedShippingMethod?.etaLabel ?? "Shown after selection"}
              muted
            />
            <div className="h-px bg-border" />
            <SummaryRow label="Total" value={formatMoney(grandTotal)} strong />
          </dl>

          <div className="mt-6 space-y-3">
            <Button
              type="submit"
              className="h-11 w-full rounded-full"
              disabled={checkout.isPending || !selectedShippingMethod}
            >
              {checkout.isPending
                ? "Placing order…"
                : paymentOption === "pay_now"
                  ? `Continue to ${shell.data?.paymentProvider.label ?? "checkout"}`
                  : "Place order"}
            </Button>
            <Button variant="outline" type="button" className="h-11 w-full rounded-full" asChild>
              <Link to="/shop/$storeSlug/cart" params={{ storeSlug }}>
                Back to cart
              </Link>
            </Button>
          </div>
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Default flow, less friction</AlertTitle>
          <AlertDescription>
            Guest checkout stays first. Payment confirmation, customer access, invoices, and later collections stay on one connected lifecycle.
          </AlertDescription>
        </Alert>
      </aside>
    </form>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const control = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id })
    : children;

  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-2 block text-sm">
        {label}
      </Label>
      {control}
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
