import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "@/routes/-api.documents.shared";
import { ingestResendWebhook } from "@/features/delivery/automation";

export const Route = createFileRoute("/api/communications/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const raw = await request.text();
          const result = await ingestResendWebhook(raw, request.headers);
          return jsonResponse(result);
        } catch (error) {
          return jsonResponse(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to ingest delivery webhook.",
            },
            400,
          );
        }
      },
    },
  },
});
