import { createFileRoute } from "@tanstack/react-router";
import {
  checkoutStoreOrder,
  storefrontJson,
} from "@/features/storefront/server";
import type { StoreCheckoutInput } from "@/features/storefront/types";

export const Route = createFileRoute("/api/storefront/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => null)) as StoreCheckoutInput | null;
        if (!payload) return storefrontJson({ error: "Invalid request body." }, undefined, 400);

        try {
          const { result, headers } = await checkoutStoreOrder(request, payload);
          return storefrontJson(result, headers);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to place order.";
          return storefrontJson({ error: message }, undefined, /not available|empty|only|disabled/i.test(message) ? 409 : 500);
        }
      },
    },
  },
});
