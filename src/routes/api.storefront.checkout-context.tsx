import { createFileRoute } from "@tanstack/react-router";
import { getStoreCheckoutContext, storefrontJson } from "@/features/storefront/server";
import type { StoreCheckoutInput } from "@/features/storefront/types";

export const Route = createFileRoute("/api/storefront/checkout-context")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => null)) as
          | Pick<StoreCheckoutInput, "storeSlug" | "items">
          | null;
        if (!payload?.storeSlug) {
          return storefrontJson({ error: "storeSlug is required." }, undefined, 400);
        }

        try {
          return storefrontJson(
            await getStoreCheckoutContext(request, {
              storeSlug: payload.storeSlug,
              items: Array.isArray(payload.items) ? payload.items : [],
            }),
          );
        } catch (error) {
          return storefrontJson(
            { error: error instanceof Error ? error.message : "Failed to load checkout context." },
            undefined,
            500,
          );
        }
      },
    },
  },
});
