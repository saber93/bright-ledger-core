import { createFileRoute } from "@tanstack/react-router";
import {
  jsonResponse,
  requireCompanyApiAccess,
} from "@/routes/-api.documents.shared";
import {
  sendDocumentDelivery,
  type DeliveryDocumentType,
  type DeliveryEventType,
} from "@/features/delivery/automation";
import type { DeliveryTemplateKey } from "@/features/delivery/templates";
import { loadDeliveryContext } from "@/features/delivery/server";

const deliveryRoles: Record<DeliveryDocumentType, Array<
  | "owner"
  | "accountant"
  | "cashier"
  | "sales_manager"
  | "store_manager"
>> = {
  invoice: ["owner", "accountant", "sales_manager"],
  credit_note: ["owner", "accountant", "sales_manager"],
  pos_receipt: ["owner", "accountant", "cashier", "sales_manager", "store_manager"],
  bill: ["owner", "accountant"],
  customer_statement: ["owner", "accountant", "sales_manager"],
};

function isDocumentType(value: unknown): value is DeliveryDocumentType {
  return (
    value === "invoice" ||
    value === "credit_note" ||
    value === "pos_receipt" ||
    value === "bill" ||
    value === "customer_statement"
  );
}

function isEventType(value: unknown): value is DeliveryEventType {
  return value === "send" || value === "reminder" || value === "statement";
}

function stageKeyFor(
  eventType: DeliveryEventType,
  templateKey: DeliveryTemplateKey | undefined,
): "invoice" | "friendly" | "overdue" | "final" | "statement" | null {
  if (eventType === "statement") return "statement";
  if (eventType !== "reminder") return "invoice";
  if (templateKey === "reminder_friendly") return "friendly";
  if (templateKey === "reminder_final") return "final";
  return "overdue";
}

export const Route = createFileRoute("/api/communications/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!payload) return jsonResponse({ error: "Invalid request body." }, 400);

        const documentType = payload.documentType;
        const documentId = payload.documentId;
        const recipient = typeof payload.recipient === "string" ? payload.recipient.trim() : "";
        const eventType = isEventType(payload.eventType) ? payload.eventType : "send";
        const templateKey =
          typeof payload.templateKey === "string" ? (payload.templateKey as DeliveryTemplateKey) : undefined;
        const recipientName =
          typeof payload.recipientName === "string" ? payload.recipientName.trim() : null;
        const subject =
          typeof payload.subject === "string" ? payload.subject.trim() : null;
        const message =
          typeof payload.message === "string" ? payload.message.trim() : null;

        if (!isDocumentType(documentType) || typeof documentId !== "string" || !documentId) {
          return jsonResponse({ error: "A valid finance document is required." }, 400);
        }
        if (!recipient || !recipient.includes("@")) {
          return jsonResponse({ error: "Enter a valid recipient email address." }, 400);
        }
        if (eventType === "reminder" && documentType !== "invoice") {
          return jsonResponse({ error: "Reminders are only supported for customer invoices." }, 400);
        }
        if (eventType === "statement" && documentType !== "customer_statement") {
          return jsonResponse({ error: "Statement sends are only supported for customer statements." }, 400);
        }

        const context = await loadDeliveryContext(documentType, documentId);
        if (!context) return jsonResponse({ error: "Document not found." }, 404);

        const access = await requireCompanyApiAccess(request, context.companyId, deliveryRoles[documentType]);
        if (!access.ok) return access.response;

        try {
          const result = await sendDocumentDelivery({
            request,
            userId: access.userId,
            documentType,
            documentId,
            eventType,
            templateKey,
            recipient,
            recipientName,
            subjectOverride: subject,
            messageOverride: message,
            stageKey: stageKeyFor(eventType, templateKey),
            sendMode: "manual",
            forceNew: false,
          });
          return jsonResponse(result);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to send document email.";
          return jsonResponse(
            {
              error: message,
            },
            /suppressed|invalid/i.test(message) ? 409 : 500,
          );
        }
      },
    },
  },
});
