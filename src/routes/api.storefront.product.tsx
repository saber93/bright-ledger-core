import { createFileRoute } from "@tanstack/react-router";
import {
  getStoreProduct,
  storefrontJson,
} from "@/features/storefront/server";

export const Route = createFileRoute("/api/storefront/product")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const storeSlug = url.searchParams.get("storeSlug")?.trim();
        const productKey = url.searchParams.get("productKey")?.trim();
        if (!storeSlug || !productKey) {
          return storefrontJson({ error: "storeSlug and productKey are required." }, undefined, 400);
        }

        try {
          return storefrontJson(await getStoreProduct(request, storeSlug, productKey));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load product.";
          return storefrontJson({ error: message }, undefined, /not found/i.test(message) ? 404 : 500);
        }
      },
    },
  },
});
