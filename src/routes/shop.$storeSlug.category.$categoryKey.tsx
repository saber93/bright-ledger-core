import { createFileRoute } from "@tanstack/react-router";
import { CatalogBrowser } from "@/components/storefront/CatalogBrowser";
import { useStoreCatalog } from "@/features/storefront/hooks";

export const Route = createFileRoute("/shop/$storeSlug/category/$categoryKey")({
  component: StorefrontCategoryPage,
});

function StorefrontCategoryPage() {
  const { storeSlug, categoryKey } = Route.useParams();
  const categoryQuery = useStoreCatalog({
    storeSlug,
    categoryKey,
    page: 1,
    sort: "featured",
  });
  const category = categoryQuery.data?.shell.categories.find((item) => item.key === categoryKey);

  return (
    <CatalogBrowser
      storeSlug={storeSlug}
      initialCategoryKey={categoryKey}
      title={category?.name ?? "Category"}
      description="Focused browsing for one collection, with the same stock-aware, ERP-backed product data."
    />
  );
}
