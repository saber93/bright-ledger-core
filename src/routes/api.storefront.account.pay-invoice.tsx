import { createFileRoute } from "@tanstack/react-router";
import {
  payPortalInvoice,
  storefrontJson,
  storefrontUnauthorizedJson,
} from "@/features/storefront/server";
import type { PortalInvoicePaymentInput } from "@/features/storefront/types";

export const Route = createFileRoute("/api/storefront/account/pay-invoice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => null)) as PortalInvoicePaymentInput | null;
        if (!payload) return storefrontJson({ error: "Invalid request body." }, undefined, 400);

        try {
          return storefrontJson(await payPortalInvoice(request, payload));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to pay invoice.";
          if (/sign in/i.test(message)) return storefrontUnauthorizedJson(message);
          return storefrontJson({ error: message }, undefined, /already paid|not found/i.test(message) ? 409 : 500);
        }
      },
    },
  },
});
