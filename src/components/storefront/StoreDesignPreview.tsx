import { CreditCard, ShieldCheck, ShoppingBag, ShoppingCart, Truck, UserRound } from "lucide-react";
import { storefrontThemeStyleVars, type StoreDesignConfig } from "@/features/storefront/design";
import { cn } from "@/lib/utils";

interface PreviewProduct {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  categoryName: string | null;
  isPublished: boolean;
  presentation: {
    shortCopy: string;
    badge: string;
  };
}

export function StoreDesignPreview({
  design,
  storeName,
  storeTagline,
  announcement,
  products,
  device = "desktop",
}: {
  design: StoreDesignConfig;
  storeName: string;
  storeTagline: string;
  announcement: string;
  products: PreviewProduct[];
  device?: "desktop" | "mobile";
}) {
  const activeProducts = products.filter((product) => product.isPublished).slice(0, 3);
  const cardClass = cn(
    "border bg-[var(--store-surface)] shadow-[var(--store-shadow-card)]",
    design.brand.cardStyle === "flat" && "shadow-none",
  );
  const previewWidth = device === "mobile" ? "max-w-[390px]" : "max-w-[1040px]";
  const buttonRadius = design.brand.buttonStyle === "pill" ? "999px" : "18px";
  const buttonStyle =
    design.brand.buttonStyle === "underline"
      ? {
          background: "transparent",
          color: "var(--store-primary)",
          borderBottom: "2px solid var(--store-primary)",
          borderRadius: "0px",
        }
      : {
          background: "var(--store-primary)",
          color: "#ffffff",
          borderRadius: buttonRadius,
        };
  const secondaryButtonStyle =
    design.brand.buttonStyle === "underline"
      ? {
          background: "transparent",
          color: "var(--store-accent)",
          borderBottom: "2px solid var(--store-accent)",
          borderRadius: "0px",
        }
      : {
          background: "rgba(var(--store-primary-rgb), 0.08)",
          color: "var(--store-primary)",
          borderRadius: buttonRadius,
        };

  return (
    <div
      className={cn("mx-auto overflow-hidden rounded-[36px] border bg-white", previewWidth)}
      style={{
        ...storefrontThemeStyleVars(design),
        fontFamily: "var(--store-body-font)",
        borderColor: "rgba(var(--store-primary-rgb), 0.08)",
        background:
          "radial-gradient(circle at top left, rgba(var(--store-accent-rgb), 0.12), transparent 32%), linear-gradient(180deg, var(--store-canvas) 0%, var(--store-surface) 22%, var(--store-canvas) 100%)",
      }}
    >
      {design.layout.showAnnouncementBar && announcement ? (
        <div
          className="px-4 py-2 text-center text-xs"
          style={{ background: "var(--store-primary)", color: "#ffffff" }}
        >
          {announcement}
        </div>
      ) : null}

      <div
        className={cn(
          "flex items-center gap-3 border-b px-5",
          design.layout.headerDensity === "compact" ? "py-3" : "py-4",
          design.layout.logoAlignment === "center" && "justify-center text-center",
          design.layout.logoAlignment === "left" && "justify-between",
        )}
        style={{ borderColor: "rgba(var(--store-primary-rgb), 0.08)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center text-white"
            style={{ background: "var(--store-primary)", borderRadius: "var(--store-radius-soft)" }}
          >
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div>
            <div
              className="text-lg font-semibold"
              style={{ fontFamily: "var(--store-heading-font)" }}
            >
              {storeName}
            </div>
            <div className="text-xs text-slate-500">{storeTagline}</div>
          </div>
        </div>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {design.layout.showAccountLink ? (
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm"
              style={{
                borderRadius: design.layout.navigationStyle === "pill" ? "999px" : "10px",
                background:
                  design.layout.navigationStyle === "pill"
                    ? "rgba(var(--store-primary-rgb), 0.06)"
                    : "transparent",
              }}
            >
              <UserRound className="h-4 w-4" /> Account
            </div>
          ) : null}
          {design.layout.showCartLink ? (
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-white"
              style={{ ...buttonStyle, padding: "0.55rem 0.95rem" }}
            >
              <ShoppingCart className="h-4 w-4" /> Cart
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-6 p-5">
        <section
          className={cn(
            "grid gap-5",
            design.layout.homepageLayout === "catalog"
              ? "lg:grid-cols-[1fr,1fr]"
              : "lg:grid-cols-[1.15fr,0.85fr]",
          )}
        >
          <div
            className={cn(cardClass, "p-6")}
            style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.08)" }}
          >
            <div className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--store-accent)" }}>
              {design.pages.heroEyebrow}
            </div>
            <h3
              className="mt-4 text-3xl font-semibold leading-tight"
              style={{ fontFamily: "var(--store-heading-font)" }}
            >
              {design.pages.heroTitle}
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{design.pages.heroBody}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="px-4 py-2 text-sm font-medium" style={buttonStyle}>
                {design.pages.heroPrimaryCta}
              </div>
              <div className="px-4 py-2 text-sm font-medium" style={secondaryButtonStyle}>
                {design.pages.heroSecondaryCta}
              </div>
            </div>
          </div>

          <div
            className={cn(cardClass, "p-5")}
            style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.08)" }}
          >
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {design.pages.featuredProductsTitle}
            </div>
            <div className="mt-4 space-y-3">
              {activeProducts.slice(0, 2).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 rounded-[24px] border p-3"
                  style={{ borderColor: "rgba(var(--store-primary-rgb), 0.08)" }}
                >
                  <div
                    className="h-16 w-16 shrink-0 overflow-hidden bg-slate-100"
                    style={{ borderRadius: "var(--store-radius-image)" }}
                  >
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-slate-500">
                        {product.name}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="truncate text-sm font-semibold"
                      style={{ fontFamily: "var(--store-heading-font)" }}
                    >
                      {product.name}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {product.presentation.shortCopy || product.categoryName || "Published product"}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "ml-auto text-right",
                      design.commerce.priceEmphasis === "strong" && "text-lg font-semibold",
                    )}
                  >
                    ${product.price.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">Product cards</div>
          <div
            className={cn(
              "grid gap-4",
              design.layout.catalogDensity === "compact" ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-3",
            )}
          >
            {activeProducts.map((product) => (
              <div
                key={product.id}
                className={cn(cardClass, "overflow-hidden")}
                style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.08)" }}
              >
                <div
                  className={cn(
                    "bg-slate-100",
                    design.commerce.productCardStyle === "dense" ? "aspect-[5/4]" : "aspect-[4/3]",
                  )}
                >
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-5 text-center text-sm text-slate-500">
                      {product.name}
                    </div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap gap-2">
                    {product.categoryName ? (
                      <span
                        className="inline-flex items-center px-2.5 py-1 text-[10px]"
                        style={{
                          borderRadius:
                            design.brand.badgeStyle === "pill" ? "999px" : "10px",
                          background:
                            design.brand.badgeStyle === "solid"
                              ? "var(--store-primary)"
                              : "rgba(var(--store-primary-rgb), 0.08)",
                          color:
                            design.brand.badgeStyle === "solid" ? "#ffffff" : "var(--store-primary)",
                          border:
                            design.brand.badgeStyle === "outline"
                              ? "1px solid rgba(var(--store-primary-rgb), 0.18)"
                              : "none",
                        }}
                      >
                        {product.categoryName}
                      </span>
                    ) : null}
                    {product.presentation.badge ? (
                      <span
                        className="inline-flex items-center px-2.5 py-1 text-[10px]"
                        style={{
                          borderRadius:
                            design.brand.badgeStyle === "pill" ? "999px" : "10px",
                          background: "rgba(var(--store-accent-rgb), 0.10)",
                          color: "var(--store-accent)",
                        }}
                      >
                        {product.presentation.badge}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="text-base font-semibold"
                    style={{ fontFamily: "var(--store-heading-font)" }}
                  >
                    {product.name}
                  </div>
                  <div className="text-sm text-slate-500">
                    {product.presentation.shortCopy || "Short selling copy appears here."}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={cn(
                        design.commerce.priceEmphasis === "strong" ? "text-xl font-semibold" : "font-medium",
                      )}
                    >
                      ${product.price.toFixed(2)}
                    </div>
                    <div className="px-3 py-2 text-sm font-medium" style={buttonStyle}>
                      Add
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr,0.92fr]">
          <div
            className={cn(cardClass, "p-5")}
            style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.08)" }}
          >
            <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">Checkout</div>
            <div className="space-y-4">
              <div className="flex gap-2">
                {["Shipping", "Payment", "Review"].map((step, index) => (
                  <div
                    key={step}
                    className="flex-1 px-3 py-2 text-center text-xs"
                    style={
                      design.commerce.checkoutProgressStyle === "bar"
                        ? {
                            background:
                              index === 0 ? "var(--store-primary)" : "rgba(var(--store-primary-rgb), 0.08)",
                            color: index === 0 ? "#ffffff" : "var(--store-primary)",
                            borderRadius: "10px",
                          }
                        : {
                            background:
                              index === 0 ? "var(--store-primary)" : "rgba(var(--store-primary-rgb), 0.08)",
                            color: index === 0 ? "#ffffff" : "var(--store-primary)",
                            borderRadius: "999px",
                          }
                    }
                  >
                    {step}
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["Full name", "Email", "Country", "Postal code"].map((label) => (
                  <div key={label}>
                    <div className="mb-1 text-xs text-slate-500">{label}</div>
                    <div
                      className="h-10 border px-3"
                      style={{
                        borderColor: "rgba(var(--store-primary-rgb), 0.10)",
                        borderRadius:
                          design.brand.inputStyle === "underline"
                            ? "0px"
                            : design.brand.inputStyle === "soft"
                              ? "14px"
                              : "10px",
                        background:
                          design.brand.inputStyle === "soft"
                            ? "rgba(var(--store-primary-rgb), 0.04)"
                            : "var(--store-surface)",
                        borderBottomWidth: design.brand.inputStyle === "underline" ? "2px" : "1px",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className={cn(cardClass, "p-5")}
            style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.08)" }}
          >
            <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">Customer account</div>
            <div
              className={cn(
                "grid gap-3",
                design.commerce.accountStyle === "list" ? "grid-cols-1" : "grid-cols-2",
              )}
            >
              {[
                { icon: CreditCard, label: "Open balance", value: "$420.00" },
                { icon: Truck, label: "Orders", value: "4" },
                { icon: ShieldCheck, label: "Credits", value: "$55.00" },
                { icon: UserRound, label: "Statements", value: "Ready" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[20px] border p-4"
                  style={{ borderColor: "rgba(var(--store-primary-rgb), 0.08)" }}
                >
                  <item.icon className="h-4 w-4" style={{ color: "var(--store-accent)" }} />
                  <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </div>
                  <div className="mt-2 text-lg font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
