import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "@/routes/-api.documents.shared";
import { processDeliveryOutbox } from "@/features/delivery/automation";

function validCronSecret(request: Request) {
  const expected = process.env.COMMUNICATIONS_CRON_SECRET?.trim();
  const received = request.headers.get("x-communications-secret")?.trim();
  return !!expected && !!received && expected === received;
}

export const Route = createFileRoute("/api/communications/process-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!validCronSecret(request)) {
          return jsonResponse({ error: "Invalid communications cron secret." }, 401);
        }

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

        try {
          const result = await processDeliveryOutbox({
            companyId:
              typeof body.companyId === "string" ? body.companyId : null,
            limit:
              typeof body.limit === "number"
                ? body.limit
                : typeof body.limit === "string"
                  ? parseInt(body.limit, 10)
                  : 25,
            worker: "cron",
          });
          return jsonResponse(result);
        } catch (error) {
          return jsonResponse(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to process communications queue.",
            },
            500,
          );
        }
      },
    },
  },
});
