import { createFileRoute } from "@tanstack/react-router";
import {
  getPortalDocumentUrl,
  storefrontUnauthorizedJson,
} from "@/features/storefront/server";

export const Route = createFileRoute("/api/storefront/account/document")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const storeSlug = url.searchParams.get("storeSlug")?.trim();
        const documentType = url.searchParams.get("documentType")?.trim();
        const documentId = url.searchParams.get("documentId")?.trim();

        if (
          !storeSlug ||
          !documentId ||
          (documentType !== "invoice" &&
            documentType !== "credit_note" &&
            documentType !== "customer_statement")
        ) {
          return new Response("Invalid document request.", { status: 400 });
        }

        try {
          const target = await getPortalDocumentUrl(request, {
            storeSlug,
            documentType,
            documentId,
          });
          return Response.redirect(target, 302);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to open document.";
          if (/sign in/i.test(message)) return storefrontUnauthorizedJson(message);
          return new Response(message, { status: /access denied|not found/i.test(message) ? 403 : 500 });
        }
      },
    },
  },
});
