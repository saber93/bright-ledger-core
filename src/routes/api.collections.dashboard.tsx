import { createFileRoute } from "@tanstack/react-router";
import {
  jsonResponse,
  requireCompanyApiAccess,
} from "@/routes/-api.documents.shared";
import { getCollectionsDashboard } from "@/features/delivery/automation";

const collectionRoles = ["owner", "accountant", "sales_manager"] as const;

export const Route = createFileRoute("/api/collections/dashboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const companyId = url.searchParams.get("companyId");
        if (!companyId) return jsonResponse({ error: "companyId is required." }, 400);

        const access = await requireCompanyApiAccess(
          request,
          companyId,
          [...collectionRoles],
        );
        if (!access.ok) return access.response;

        try {
          const result = await getCollectionsDashboard({
            companyId,
            search: url.searchParams.get("search"),
            stage: url.searchParams.get("stage"),
          });
          return jsonResponse(result);
        } catch (error) {
          return jsonResponse(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to load collections dashboard.",
            },
            500,
          );
        }
      },
    },
  },
});
