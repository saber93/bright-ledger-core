import { createFileRoute } from "@tanstack/react-router";
import {
  getStoreCatalog,
  storefrontJson,
} from "@/features/storefront/server";

export const Route = createFileRoute("/api/storefront/catalog")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const storeSlug = url.searchParams.get("storeSlug")?.trim();
        if (!storeSlug) return storefrontJson({ error: "storeSlug is required." }, undefined, 400);

        try {
          const result = await getStoreCatalog({
            request,
            storeSlug,
            search: url.searchParams.get("search"),
            categoryKey: url.searchParams.get("categoryKey"),
            sort:
              url.searchParams.get("sort") === "price_asc" ||
              url.searchParams.get("sort") === "price_desc" ||
              url.searchParams.get("sort") === "name"
                ? (url.searchParams.get("sort") as "price_asc" | "price_desc" | "name")
                : "featured",
            inStockOnly: url.searchParams.get("inStockOnly") === "true",
            page: Number(url.searchParams.get("page") ?? "1"),
            pageSize: Number(url.searchParams.get("pageSize") ?? "12"),
          });
          return storefrontJson(result);
        } catch (error) {
          return storefrontJson(
            { error: error instanceof Error ? error.message : "Failed to load storefront catalog." },
            undefined,
            500,
          );
        }
      },
    },
  },
});
