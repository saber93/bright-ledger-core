import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/features/storefront/cart";
import { useStoreProduct } from "@/features/storefront/hooks";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/shop/$storeSlug/product/$productKey")({
  component: StorefrontProductPage,
});

function StorefrontProductPage() {
  const { storeSlug, productKey } = Route.useParams();
  const query = useStoreProduct(storeSlug, productKey);
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!query.data) return;
    const { product, shell } = query.data;
    const title = product.seoTitle ?? `${product.name} | ${shell.storeName}`;
    document.title = title;
    const description = product.seoDescription ?? product.shortCopy ?? product.shortDescription;
    if (!description) return;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", description);
    }
  }, [query.data]);

  if (query.isLoading) {
    return <div className="py-16 text-sm text-muted-foreground">Loading product…</div>;
  }

  if (query.error || !query.data) {
    return <div className="py-16 text-sm text-muted-foreground">This product could not be loaded.</div>;
  }

  const { product, shell } = query.data;
  const design = shell.design;
  const gallery = product.gallery.length > 0 ? product.gallery : product.imageUrl ? [product.imageUrl] : [];
  const primaryImage = gallery[0] ?? null;

  return (
    <div className="space-y-10 pb-8">
      <Link
        to="/shop/$storeSlug"
        params={{ storeSlug }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to storefront
      </Link>

      <section
        className={`grid gap-8 ${
          design.layout.productLayout === "stacked"
            ? "lg:grid-cols-1"
            : design.layout.productLayout === "editorial"
              ? "lg:grid-cols-[0.92fr,1.08fr]"
              : "lg:grid-cols-[1.02fr,0.98fr]"
        }`}
      >
        <div className="space-y-4">
          <div
            className="overflow-hidden border bg-card shadow-sm"
            style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
          >
            <div className="aspect-[4/3] bg-[radial-gradient(circle_at_top_left,_rgba(var(--store-primary-rgb),0.16),_transparent_55%),linear-gradient(180deg,#ffffff_0%,rgba(var(--store-secondary-rgb),0.18)_100%)]">
              {primaryImage ? (
                <img src={primaryImage} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center px-10 text-center text-lg text-muted-foreground">
                  {product.name}
                </div>
              )}
            </div>
          </div>

          {gallery.length > 1 ? (
            <div className="grid grid-cols-4 gap-3">
              {gallery.slice(0, 4).map((image) => (
                <div
                  key={image}
                  className="aspect-square overflow-hidden border bg-card/70"
                  style={{ borderRadius: "var(--store-radius-soft)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
                >
                  <img src={image} alt={product.name} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {product.categoryName ? <Badge variant="secondary">{product.categoryName}</Badge> : null}
              {design.commerce.stockBadgeVisibility && product.badge ? <Badge variant="outline">{product.badge}</Badge> : null}
            </div>
            <h1
              className="text-4xl font-semibold tracking-tight text-balance"
              style={{ fontFamily: "var(--store-heading-font)" }}
            >
              {product.name}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              {product.shortCopy ?? product.description ?? product.shortDescription ?? "Published product ready for checkout."}
            </p>
          </div>

          <div
            className="grid gap-4 border bg-card/80 p-5 shadow-sm sm:grid-cols-2"
            style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
          >
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Price</div>
              <div className={design.commerce.priceEmphasis === "strong" ? "mt-2 text-4xl font-semibold" : "mt-2 text-3xl font-semibold"}>
                {formatMoney(product.price)}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{product.taxLabel}</div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-2xl bg-muted/40 p-3">
                <div className="font-medium">{product.availabilityLabel}</div>
                <div className="mt-1 text-muted-foreground">
                  SKU {product.sku ?? "—"} · Unit {product.unit ?? "each"}
                </div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3">
                <div className="font-medium">Shipping & pickup</div>
                <div className="mt-1 text-muted-foreground">
                  {product.shippingNote ?? "Shipping and pickup availability follow the merchant’s store settings."}
                </div>
              </div>
            </div>
          </div>

          {product.highlights.length ? (
            <div
              className="rounded-[24px] border bg-card/70 p-5"
              style={{ borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
            >
              <div className="text-sm font-semibold" style={{ fontFamily: "var(--store-heading-font)" }}>
                Why this product stands out
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {product.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--store-accent)]" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`inline-flex items-center border bg-background ${
                design.commerce.quantitySelectorStyle === "inline" ? "rounded-2xl px-2" : "rounded-full p-1"
              }`}
              style={{ borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              >
                -
              </Button>
              <span className="min-w-[3ch] text-center text-sm font-medium">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                aria-label="Increase quantity"
                onClick={() => setQuantity((current) => current + 1)}
              >
                +
              </Button>
            </div>
            <Button
              size="lg"
              className="rounded-full px-6"
              disabled={!product.inStock}
              onClick={() => cart.addItem(product, quantity)}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {product.inStock ? "Add to cart" : "Unavailable"}
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-6" asChild>
              <Link to="/shop/$storeSlug/cart" params={{ storeSlug }}>
                View cart
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TrustCard icon={ShieldCheck} title="ERP-backed totals" text={product.trustNote ?? "Prices, tax, stock, and invoice follow the same operational records the team uses internally."} />
            <TrustCard icon={Truck} title="Traceable fulfillment" text="Online orders stay connected to sales, inventory, payments, and customer documents." />
          </div>
        </div>
      </section>

      {product.related.length ? (
        <section className="space-y-5">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Related</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">More from this collection</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {product.related.map((item) => (
              <ProductCard key={item.id} storeSlug={storeSlug} product={item} compact design={design} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TrustCard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-card/70 p-4">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-3 font-medium">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{text}</div>
    </div>
  );
}
