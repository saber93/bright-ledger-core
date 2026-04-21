import { createFileRoute } from "@tanstack/react-router";
import {
  accessPortalAccount,
  storefrontJson,
} from "@/features/storefront/server";
import type { PortalAccessInput } from "@/features/storefront/types";

export const Route = createFileRoute("/api/storefront/account/access")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => null)) as PortalAccessInput | null;
        if (!payload) return storefrontJson({ error: "Invalid request body." }, undefined, 400);

        try {
          const headers = await accessPortalAccount(request, payload);
          return storefrontJson({ ok: true }, headers);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to access account.";
          return storefrontJson({ error: message }, undefined, 403);
        }
      },
    },
  },
});
