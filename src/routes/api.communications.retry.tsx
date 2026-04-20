import { createFileRoute } from "@tanstack/react-router";
import {
  jsonResponse,
  requireCompanyApiAccess,
} from "@/routes/-api.documents.shared";
import { retryFailedDelivery } from "@/features/delivery/automation";

const collectionRoles = ["owner", "accountant", "sales_manager"] as const;

export const Route = createFileRoute("/api/communications/retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return jsonResponse({ error: "Invalid request body." }, 400);

        const companyId =
          typeof body.companyId === "string" ? body.companyId.trim() : "";
        const deliveryId =
          typeof body.deliveryId === "string" ? body.deliveryId.trim() : "";
        if (!companyId || !deliveryId) {
          return jsonResponse({ error: "companyId and deliveryId are required." }, 400);
        }

        const access = await requireCompanyApiAccess(
          request,
          companyId,
          [...collectionRoles],
        );
        if (!access.ok) return access.response;

        try {
          const result = await retryFailedDelivery({
            deliveryId,
            actorId: access.userId,
          });
          return jsonResponse(result);
        } catch (error) {
          return jsonResponse(
            {
              error:
                error instanceof Error ? error.message : "Failed to retry delivery.",
            },
            500,
          );
        }
      },
    },
  },
});
