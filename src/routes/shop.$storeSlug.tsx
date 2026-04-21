import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ShoppingBag, ShoppingCart, UserRound } from "lucide-react";
import { CartProvider, useCart } from "@/features/storefront/cart";
import { useStoreShell } from "@/features/storefront/hooks";
import { storefrontThemeStyleVars } from "@/features/storefront/design";
import { Button } from "@/components/ui/button";
import { formatStoreUrlPath } from "@/features/storefront/shared";

export const Route = createFileRoute("/shop/$storeSlug")({
  component: StorefrontLayoutRoute,
});

function StorefrontLayoutRoute() {
  const { storeSlug } = Route.useParams();
  return (
    <CartProvider storeSlug={storeSlug}>
      <StorefrontLayout storeSlug={storeSlug} />
    </CartProvider>
  );
}

function StorefrontLayout({ storeSlug }: { storeSlug: string }) {
  const shell = useStoreShell(storeSlug);
  const cart = useCart();

  if (shell.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading storefront…</div>
      </div>
    );
  }

  if (shell.error || !shell.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-lg rounded-[28px] border border-border/70 bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Storefront unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This store is not live yet, or the public store URL still needs to be configured.
          </p>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link to="/login">Merchant sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const design = shell.data.design;
  const navClass =
    design.layout.navigationStyle === "pill"
      ? "rounded-full bg-[rgba(var(--store-primary-rgb),0.06)]"
      : design.layout.navigationStyle === "underline"
        ? "rounded-none border-b-2 border-transparent hover:border-[var(--store-primary)]"
        : "rounded-lg";
  const footerColumns =
    design.layout.footerStyle === "minimal"
      ? "lg:grid-cols-[1.4fr,1fr]"
      : "lg:grid-cols-[1.4fr,1fr,1fr]";

  return (
    <div
      className="min-h-screen text-foreground"
      style={{
        ...storefrontThemeStyleVars(design),
        fontFamily: "var(--store-body-font)",
        background:
          "radial-gradient(circle at top left, rgba(var(--store-accent-rgb), 0.10), transparent 24%), linear-gradient(180deg, var(--store-canvas) 0%, var(--store-surface) 22%, var(--store-canvas) 100%)",
      }}
    >
      {design.advanced.customCss ? <style>{design.advanced.customCss}</style> : null}

      {shell.data.previewMode ? (
        <div
          className="border-b px-4 py-2 text-center text-xs"
          style={{
            borderColor: "rgba(var(--store-primary-rgb), 0.10)",
            background: "rgba(var(--store-accent-rgb), 0.14)",
            color: "var(--store-primary)",
          }}
        >
          Draft preview
          {shell.data.previewExpiresAt
            ? ` · expires ${new Date(shell.data.previewExpiresAt).toLocaleString()}`
            : ""}
        </div>
      ) : null}

      {design.layout.showAnnouncementBar && shell.data.storeAnnouncement ? (
        <div
          className="border-b px-4 py-2 text-center text-xs"
          style={{
            borderColor: "rgba(var(--store-primary-rgb), 0.10)",
            background: "var(--store-primary)",
            color: "#ffffff",
          }}
        >
          {shell.data.storeAnnouncement}
        </div>
      ) : null}

      <header
        className={`${design.layout.stickyHeader ? "sticky top-0" : "relative"} z-40 border-b backdrop-blur`}
        style={{
          borderColor: "rgba(var(--store-primary-rgb), 0.10)",
          background: "rgba(255,255,255,0.92)",
        }}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8 ${
            design.layout.headerDensity === "compact" ? "py-3" : "py-4"
          } ${design.layout.logoAlignment === "center" ? "justify-center" : "justify-between"}`}
        >
          <div className="min-w-0">
            <Link
              to="/shop/$storeSlug"
              params={{ storeSlug }}
              className="inline-flex items-center gap-3"
            >
              <div
                className="flex h-11 w-11 items-center justify-center text-background shadow-sm"
                style={{
                  background: "var(--store-primary)",
                  borderRadius: "var(--store-radius-soft)",
                }}
              >
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div
                  className="truncate text-lg font-semibold tracking-tight"
                  style={{ fontFamily: "var(--store-heading-font)" }}
                >
                  {shell.data.storeName}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {shell.data.storeTagline ?? "ERP-connected storefront"}
                </div>
              </div>
            </Link>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" asChild className={navClass}>
              <Link to="/shop/$storeSlug" params={{ storeSlug }}>
                Shop
              </Link>
            </Button>
            {design.layout.showAccountLink ? (
              <Button variant="ghost" asChild className={navClass}>
                <Link to="/shop/$storeSlug/account" params={{ storeSlug }}>
                  Account
                </Link>
              </Button>
            ) : null}
          </nav>

          <div className={`flex items-center gap-2 ${design.layout.logoAlignment === "center" ? "ml-auto" : ""}`}>
            {design.layout.showAccountLink ? (
              <Button variant="outline" size="icon" className="rounded-full" asChild>
                <Link to="/shop/$storeSlug/account" params={{ storeSlug }} aria-label="Account">
                  <UserRound className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            {design.layout.showCartLink ? (
              <Button variant="default" className="rounded-full px-4" asChild>
                <Link to="/shop/$storeSlug/cart" params={{ storeSlug }}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Cart
                  <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-xs">
                    {cart.count}
                  </span>
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer
        className="border-t"
        style={{
          borderColor: "rgba(var(--store-primary-rgb), 0.10)",
          background: "rgba(255,255,255,0.70)",
        }}
      >
        <div className={`mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm sm:px-6 ${footerColumns} lg:px-8`}>
          <div>
            <div className="text-base font-semibold" style={{ fontFamily: "var(--store-heading-font)" }}>
              {shell.data.storeName}
            </div>
            <p className="mt-2 max-w-md text-muted-foreground">
              Clear pricing, ERP-backed fulfillment, and a customer account that stays in step with invoices, payments, and credits.
            </p>
          </div>
          {design.layout.showSupportStrip ? (
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Support</div>
              <div className="mt-3 space-y-2">
                <div>{shell.data.supportEmail ?? "Support email configured in setup"}</div>
                <div>{shell.data.contactPhone ?? "Business phone configured in setup"}</div>
              </div>
            </div>
          ) : null}
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Store URL</div>
            <div className="mt-3 text-muted-foreground">{formatStoreUrlPath(storeSlug)}</div>
            {design.layout.showPaymentStrip ? (
              <div className="mt-2 text-muted-foreground">
                {shell.data.shippingEnabled ? "Shipping" : "Local fulfillment"} ·{" "}
                {shell.data.onlinePaymentsEnabled ? "Online payments" : "Invoice later"}
              </div>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
