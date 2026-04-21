import { createFileRoute } from "@tanstack/react-router";
import {
  getPortalAccount,
  storefrontJson,
  storefrontUnauthorizedJson,
} from "@/features/storefront/server";

export const Route = createFileRoute("/api/storefront/account")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const storeSlug = url.searchParams.get("storeSlug")?.trim();
        if (!storeSlug) return storefrontJson({ error: "storeSlug is required." }, undefined, 400);

        try {
          return storefrontJson(await getPortalAccount(request, storeSlug));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load account.";
          if (/sign in/i.test(message)) return storefrontUnauthorizedJson(message);
          return storefrontJson({ error: message }, undefined, /not available/i.test(message) ? 404 : 500);
        }
      },
    },
  },
});
