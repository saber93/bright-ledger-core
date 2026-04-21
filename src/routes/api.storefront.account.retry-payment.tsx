import { createFileRoute } from "@tanstack/react-router";
import {
  retryStoreOrderPayment,
  storefrontJson,
  storefrontUnauthorizedJson,
} from "@/features/storefront/server";

export const Route = createFileRoute("/api/storefront/account/retry-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => null)) as
          | { storeSlug?: string; orderId?: string }
          | null;
        if (!payload?.storeSlug || !payload.orderId) {
          return storefrontJson({ error: "storeSlug and orderId are required." }, undefined, 400);
        }

        try {
          return storefrontJson(
            await retryStoreOrderPayment(request, {
              storeSlug: payload.storeSlug,
              orderId: payload.orderId,
            }),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to retry payment.";
          if (/sign in/i.test(message)) return storefrontUnauthorizedJson(message);
          return storefrontJson({ error: message }, undefined, 500);
        }
      },
    },
  },
});
