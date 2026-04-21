import { Link } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { StoreDesignConfig } from "@/features/storefront/design";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStoreCatalog } from "@/features/storefront/hooks";

export function CatalogBrowser({
  storeSlug,
  title,
  description,
  initialCategoryKey = null,
  design,
}: {
  storeSlug: string;
  title: string;
  description: string;
  initialCategoryKey?: string | null;
  design?: StoreDesignConfig;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [categoryKey, setCategoryKey] = useState<string | null>(initialCategoryKey);
  const [sort, setSort] = useState<"featured" | "price_asc" | "price_desc" | "name">("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setCategoryKey(initialCategoryKey);
    setPage(1);
  }, [initialCategoryKey]);

  const query = useStoreCatalog({
    storeSlug,
    search: deferredSearch,
    categoryKey,
    sort,
    inStockOnly,
    page,
  });

  const totalPages = useMemo(() => {
    if (!query.data || query.data.pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(query.data.total / query.data.pageSize));
  }, [query.data]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, categoryKey, sort, inStockOnly]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Catalog</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm">
          <SlidersHorizontal className="h-4 w-4" />
          {query.data?.total ?? 0} products
        </div>
      </div>

      <div className="grid gap-3 rounded-[28px] border border-border/70 bg-card/80 p-4 shadow-sm lg:grid-cols-[1.2fr,auto,auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products, categories, or SKU"
            className="h-11 rounded-full border-none bg-muted/50 pl-10"
          />
        </label>
        <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
          <SelectTrigger className="h-11 rounded-full">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="featured">Featured first</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="price_asc">Price: low to high</SelectItem>
            <SelectItem value="price_desc">Price: high to low</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={inStockOnly ? "default" : "outline"}
          className="h-11 rounded-full"
          onClick={() => setInStockOnly((current) => !current)}
        >
          In-stock only
        </Button>
      </div>

      {query.data?.shell.categories.length ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!categoryKey ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setCategoryKey(null)}
          >
            All products
          </Button>
          {query.data.shell.categories.map((category) => (
            <Link
              key={category.id}
              to="/shop/$storeSlug/category/$categoryKey"
              params={{ storeSlug, categoryKey: category.key }}
              className="inline-flex"
            >
              <Badge
                variant={categoryKey === category.key ? "default" : "outline"}
                className={`px-3 py-1.5 text-xs ${
                  design?.layout.catalogLayout === "minimal" ? "rounded-xl" : "rounded-full"
                }`}
              >
                {category.name} · {category.productCount}
              </Badge>
            </Link>
          ))}
        </div>
      ) : null}

      {query.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[340px] animate-pulse rounded-[28px] border bg-muted/30" />
          ))}
        </div>
      ) : query.data?.products.length ? (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {query.data.products.map((product) => (
              <ProductCard
                key={product.id}
                storeSlug={storeSlug}
                product={product}
                design={design ?? query.data?.shell.design}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-[24px] border border-border/60 bg-card/70 px-5 py-4 text-sm text-muted-foreground">
            <span>
              Page {query.data.page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-[28px] border border-dashed border-border/80 bg-card/60 px-6 py-14 text-center">
          <h3 className="text-lg font-semibold">No products matched those filters</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a different search, switch category, or clear the stock filter.
          </p>
        </div>
      )}
    </section>
  );
}
