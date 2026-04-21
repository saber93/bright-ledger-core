import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Truck, Wallet } from "lucide-react";
import { CatalogBrowser } from "@/components/storefront/CatalogBrowser";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Button } from "@/components/ui/button";
import { useStoreCatalog } from "@/features/storefront/hooks";
import type { HomeSectionId, StoreDesignConfig } from "@/features/storefront/design";
import type { StorefrontCategory, StorefrontProductCard } from "@/features/storefront/types";

export const Route = createFileRoute("/shop/$storeSlug/")({
  component: StorefrontHomePage,
});

function StorefrontHomePage() {
  const { storeSlug } = Route.useParams();
  const featured = useStoreCatalog({ storeSlug, page: 1, sort: "featured" });
  const shell = featured.data?.shell;
  const design = shell?.design;
  const sections = design?.pages.homeSections ?? [];

  if (featured.isLoading && !featured.data) {
    return <div className="py-16 text-sm text-muted-foreground">Loading storefront…</div>;
  }

  return (
    <div className="space-y-12 pb-8">
      {sections.map((section) => (
        <HomeSection
          key={section}
          section={section}
          storeSlug={storeSlug}
          featured={featured.data?.products ?? []}
          categories={shell?.categories ?? []}
          design={design}
        />
      ))}

      <CatalogBrowser
        storeSlug={storeSlug}
        title="Browse what’s live"
        description="Published products with current pricing, tax visibility, and real stock-aware status."
        design={design}
      />
    </div>
  );
}

function HomeSection({
  section,
  storeSlug,
  featured,
  categories,
  design,
}: {
  section: HomeSectionId;
  storeSlug: string;
  featured: StorefrontProductCard[];
  categories: StorefrontCategory[];
  design: StoreDesignConfig | undefined;
}) {
  if (!design) return null;

  if (section === "hero") {
    return (
      <section
        className={`grid gap-8 overflow-hidden border p-6 shadow-sm lg:p-8 ${
          design.layout.homepageLayout === "catalog"
            ? "lg:grid-cols-[1fr,1fr]"
            : "lg:grid-cols-[1.25fr,0.9fr]"
        }`}
        style={{
          borderColor: "rgba(var(--store-primary-rgb), 0.10)",
          borderRadius: "var(--store-radius-card)",
          background: "rgba(255,255,255,0.88)",
          boxShadow: "var(--store-shadow-card)",
        }}
      >
        <div className="space-y-6">
          <div className="inline-flex rounded-full border border-border/70 bg-background px-4 py-1.5 text-xs uppercase tracking-[0.26em] text-muted-foreground">
            {design.pages.heroEyebrow}
          </div>
          <div className="space-y-4">
            <h1
              className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
              style={{ fontFamily: "var(--store-heading-font)" }}
            >
              {design.pages.heroTitle}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              {design.pages.heroBody}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="rounded-full px-6" asChild>
              <Link to="/shop/$storeSlug/cart" params={{ storeSlug }}>
                {design.pages.heroPrimaryCta}
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-6" asChild>
              <Link to="/shop/$storeSlug/account/access" params={{ storeSlug }}>
                {design.pages.heroSecondaryCta}
              </Link>
            </Button>
          </div>
          <div
            className={`grid gap-4 pt-3 ${
              design.commerce.trustBlockStyle === "inline" ? "sm:grid-cols-1" : "sm:grid-cols-3"
            }`}
          >
            {design.pages.trustItems.slice(0, 3).map((item, index) => (
              <Feature
                key={item}
                icon={index === 0 ? Truck : index === 1 ? Wallet : ShieldCheck}
                title={item}
                text={
                  index === 0
                    ? "Stock and availability stay tied to the operational lifecycle."
                    : index === 1
                      ? "Checkout and receivables stay clear from day one."
                      : "Customer-facing documents stay traceable and securely scoped."
                }
              />
            ))}
          </div>
        </div>

        <div
          className="p-5"
          style={{
            border: "1px solid rgba(var(--store-primary-rgb), 0.10)",
            borderRadius: "var(--store-radius-soft)",
            background:
              "radial-gradient(circle at top right, rgba(var(--store-accent-rgb), 0.14), transparent 42%), linear-gradient(180deg,#ffffff 0%, rgba(var(--store-secondary-rgb), 0.14) 100%)",
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Featured right now</div>
              <div className="mt-1 text-lg font-semibold" style={{ fontFamily: "var(--store-heading-font)" }}>
                {design.pages.featuredProductsTitle}
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="grid gap-4">
            {featured.slice(0, 2).map((product) => (
              <ProductCard
                key={product.id}
                storeSlug={storeSlug}
                product={product}
                compact
                design={design}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (section === "featured_categories" && categories.length) {
    return (
      <section className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Collections</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--store-heading-font)" }}>
            {design.pages.featuredCategoriesTitle}
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {categories.slice(0, 6).map((category) => (
            <Link
              key={category.id}
              to="/shop/$storeSlug/category/$categoryKey"
              params={{ storeSlug, categoryKey: category.key }}
              className="rounded-full border bg-white/80 px-4 py-2 text-sm shadow-sm transition hover:-translate-y-0.5"
              style={{ borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
            >
              {category.name} · {category.productCount}
            </Link>
          ))}
        </div>
      </section>
    );
  }

  if (section === "featured_products" && featured.length) {
    return (
      <section className="space-y-5">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Catalogue spotlight</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--store-heading-font)" }}>
            {design.pages.featuredProductsTitle}
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {featured.slice(0, 3).map((product) => (
            <ProductCard key={product.id} storeSlug={storeSlug} product={product} design={design} />
          ))}
        </div>
      </section>
    );
  }

  if (section === "promo_banner") {
    return (
      <section
        className="rounded-[32px] border p-6 shadow-sm"
        style={{
          borderColor: "rgba(var(--store-primary-rgb), 0.10)",
          background: "linear-gradient(135deg, rgba(var(--store-primary-rgb), 0.08), rgba(var(--store-accent-rgb), 0.10))",
        }}
      >
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Launch advantage</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--store-heading-font)" }}>
            {design.pages.promoTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{design.pages.promoBody}</p>
        </div>
      </section>
    );
  }

  if (section === "trust_block") {
    return (
      <section className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Trust</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--store-heading-font)" }}>
            {design.pages.trustTitle}
          </h2>
        </div>
        <div className={`grid gap-4 ${design.commerce.trustBlockStyle === "inline" ? "md:grid-cols-1" : "md:grid-cols-3"}`}>
          {design.pages.trustItems.map((item) => (
            <div
              key={item}
              className="rounded-[24px] border bg-white/80 p-5 shadow-sm"
              style={{ borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
            >
              <div className="font-medium">{item}</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (section === "testimonials") {
    return (
      <section
        className="rounded-[32px] border bg-white/88 p-6 shadow-sm"
        style={{ borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
      >
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Testimonial</div>
        <blockquote className="mt-3 text-xl font-medium leading-8" style={{ fontFamily: "var(--store-heading-font)" }}>
          “{design.pages.testimonialQuote}”
        </blockquote>
        <div className="mt-4 text-sm text-muted-foreground">{design.pages.testimonialAuthor}</div>
      </section>
    );
  }

  if (section === "faq" && design.pages.faqItems.length) {
    return (
      <section className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">FAQ</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--store-heading-font)" }}>
            Helpful before checkout
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {design.pages.faqItems.map((item) => (
            <div
              key={item.question}
              className="rounded-[24px] border bg-white/80 p-5 shadow-sm"
              style={{ borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
            >
              <div className="font-medium">{item.question}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (section === "newsletter") {
    return (
      <section
        className="rounded-[32px] border bg-white/88 p-6 shadow-sm"
        style={{ borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
      >
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Follow-up</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--store-heading-font)" }}>
            {design.pages.newsletterTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{design.pages.newsletterBody}</p>
        </div>
      </section>
    );
  }

  return null;
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-background/80 p-4">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-3 text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{text}</div>
    </div>
  );
}
