import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/features/storefront/cart";
import type { StoreDesignConfig } from "@/features/storefront/design";
import type { StorefrontProductCard } from "@/features/storefront/types";
import { formatMoney } from "@/lib/format";

export function ProductCard({
  storeSlug,
  product,
  compact = false,
  design,
}: {
  storeSlug: string;
  product: StorefrontProductCard;
  compact?: boolean;
  design?: StoreDesignConfig;
}) {
  const cart = useCart();
  const hrefParams = { storeSlug, productKey: product.key };
  const productCardStyle = design?.commerce.productCardStyle ?? "editorial";
  const badgeStyle = design?.brand.badgeStyle ?? "pill";
  const showBadge = design?.commerce.stockBadgeVisibility ?? true;

  return (
    <div
      className={`group overflow-hidden border transition hover:-translate-y-0.5 hover:shadow-lg ${
        productCardStyle === "dense" ? "rounded-[22px]" : "rounded-[28px]"
      }`}
      style={{
        borderColor: "rgba(var(--store-primary-rgb), 0.10)",
        background: "rgba(255,255,255,0.88)",
        boxShadow: "var(--store-shadow-card)",
      }}
    >
      <Link
        to="/shop/$storeSlug/product/$productKey"
        params={hrefParams}
        className="block"
      >
        <div
          className={`relative overflow-hidden ${
            productCardStyle === "dense" ? "aspect-[5/4]" : "aspect-[4/3]"
          }`}
          style={{
            background:
              "radial-gradient(circle at top left, rgba(var(--store-primary-rgb), 0.14), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.7), rgba(var(--store-secondary-rgb), 0.14))",
          }}
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
              {product.name}
            </div>
          )}
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {product.categoryName && (
              <Badge
                variant="secondary"
                className="bg-background/90 px-3 text-[10px]"
                style={{ borderRadius: badgeStyle === "pill" ? "999px" : "10px" }}
              >
                {product.categoryName}
              </Badge>
            )}
            {showBadge && product.badge && (
              <Badge
                variant={product.inStock ? "outline" : "secondary"}
                className="bg-background/90 px-3 text-[10px]"
                style={{ borderRadius: badgeStyle === "pill" ? "999px" : "10px" }}
              >
                {product.badge}
              </Badge>
            )}
          </div>
        </div>
      </Link>

      <div className={compact ? "space-y-3 p-4" : "space-y-4 p-5"}>
        <div className="space-y-1.5">
          <Link
            to="/shop/$storeSlug/product/$productKey"
            params={hrefParams}
            className="line-clamp-2 text-lg font-semibold tracking-tight text-foreground transition hover:text-primary"
            style={{ fontFamily: "var(--store-heading-font)" }}
          >
            {product.name}
          </Link>
          <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
            {product.shortCopy ?? product.shortDescription ?? "ERP-connected storefront item"}
          </p>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Price
            </div>
            <div className={design?.commerce.priceEmphasis === "strong" ? "text-2xl font-semibold" : "text-xl font-semibold"}>
              {formatMoney(product.price)}
            </div>
          </div>
          <Button
            size={compact ? "sm" : "default"}
            disabled={!product.inStock}
            onClick={() => cart.addItem(product, 1)}
            className="rounded-full px-5"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {product.inStock ? "Add" : "Unavailable"}
          </Button>
        </div>
      </div>
    </div>
  );
}
