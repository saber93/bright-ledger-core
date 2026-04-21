import { createFileRoute } from "@tanstack/react-router";
import {
  getPortalOrder,
  storefrontJson,
  storefrontUnauthorizedJson,
} from "@/features/storefront/server";

export const Route = createFileRoute("/api/storefront/account/order")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const storeSlug = url.searchParams.get("storeSlug")?.trim();
        const orderId = url.searchParams.get("orderId")?.trim();
        if (!storeSlug || !orderId) {
          return storefrontJson({ error: "storeSlug and orderId are required." }, undefined, 400);
        }

        try {
          return storefrontJson(await getPortalOrder(request, storeSlug, orderId));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load order.";
          if (/sign in/i.test(message)) return storefrontUnauthorizedJson(message);
          return storefrontJson({ error: message }, undefined, /not found/i.test(message) ? 404 : 500);
        }
      },
    },
  },
});
