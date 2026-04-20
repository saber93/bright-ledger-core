import { createFileRoute } from "@tanstack/react-router";
import {
  jsonResponse,
  requireCompanyApiAccess,
} from "@/routes/-api.documents.shared";
import {
  sendReminderBatch,
  sendStatementBatch,
  type DeliveryStageKey,
} from "@/features/delivery/automation";

const collectionRoles = ["owner", "accountant", "sales_manager"] as const;

function isStage(value: unknown): value is DeliveryStageKey {
  return (
    value === "invoice" ||
    value === "friendly" ||
    value === "overdue" ||
    value === "final" ||
    value === "statement"
  );
}

export const Route = createFileRoute("/api/communications/batch-send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return jsonResponse({ error: "Invalid request body." }, 400);

        const companyId =
          typeof body.companyId === "string" ? body.companyId.trim() : "";
        const kind = body.kind === "statements" ? "statements" : "reminders";
        if (!companyId) return jsonResponse({ error: "companyId is required." }, 400);

        const access = await requireCompanyApiAccess(
          request,
          companyId,
          [...collectionRoles],
        );
        if (!access.ok) return access.response;

        try {
          const result =
            kind === "statements"
              ? await sendStatementBatch({
                  request,
                  actorId: access.userId,
                  companyId,
                  search: typeof body.search === "string" ? body.search : null,
                })
              : await sendReminderBatch({
                  request,
                  actorId: access.userId,
                  companyId,
                  search: typeof body.search === "string" ? body.search : null,
                  readyOnly: body.readyOnly === true,
                  stageOverride: isStage(body.stageOverride) ? body.stageOverride : null,
                });
          return jsonResponse(result);
        } catch (error) {
          return jsonResponse(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to send collections batch.",
            },
            500,
          );
        }
      },
    },
  },
});
