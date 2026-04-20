import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "@/routes/-api.documents.shared";
import { runScheduledCollections } from "@/features/delivery/automation";

function validCronSecret(request: Request) {
  const expected = process.env.COMMUNICATIONS_CRON_SECRET?.trim();
  const received = request.headers.get("x-communications-secret")?.trim();
  return !!expected && !!received && expected === received;
}

export const Route = createFileRoute("/api/communications/run-scheduled")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!validCronSecret(request)) {
          return jsonResponse({ error: "Invalid communications cron secret." }, 401);
        }

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const companyId =
          typeof body?.companyId === "string" ? body.companyId.trim() : "";
        if (!companyId) return jsonResponse({ error: "companyId is required." }, 400);

        try {
          const result = await runScheduledCollections({
            request,
            companyId,
          });
          return jsonResponse(result);
        } catch (error) {
          return jsonResponse(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to run scheduled collections.",
            },
            500,
          );
        }
      },
    },
  },
});
