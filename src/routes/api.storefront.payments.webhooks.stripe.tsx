import { createFileRoute } from "@tanstack/react-router";
import { handleStorefrontStripeWebhook, storefrontJson } from "@/features/storefront/server";

export const Route = createFileRoute("/api/storefront/payments/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const result = await handleStorefrontStripeWebhook(request);
          return storefrontJson(result);
        } catch (error) {
          return storefrontJson(
            { error: error instanceof Error ? error.message : "Stripe webhook failed." },
            undefined,
            400,
          );
        }
      },
    },
  },
});
