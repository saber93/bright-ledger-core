import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { apiJson } from "@/lib/api";
import {
  listDeliveryTemplateDefaults,
  mergeDeliveryTemplates,
  type DeliveryTemplateKey,
  type DeliveryTemplateRecord,
} from "@/features/delivery/templates";

export type DocumentType =
  | "invoice"
  | "credit_note"
  | "pos_receipt"
  | "bill"
  | "customer_statement";

export type DeliveryEventType = "send" | "reminder" | "statement";

export interface DocumentDelivery {
  id: string;
  company_id: string;
  document_type: DocumentType;
  document_id: string;
  document_number: string | null;
  channel: string;
  event_type: string;
  recipient: string | null;
  recipient_name: string | null;
  subject: string | null;
  message: string | null;
  template_key: string | null;
  status: string;
  error: string | null;
  provider_message_id: string | null;
  provider_name: string | null;
  sent_by: string | null;
  sent_at: string;
  send_mode: string | null;
  stage_key: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
  last_event_summary: string | null;
  last_error_kind: string | null;
  attempt_count: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  rejected_at: string | null;
  complained_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  suppressed_at: string | null;
  source_href: string | null;
  metadata: Record<string, unknown>;
}

export interface DocumentDeliveryEvent {
  id: string;
  delivery_id: string;
  provider_name: string;
  provider_message_id: string | null;
  event_type: string;
  severity: string;
  summary: string | null;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface SendDocumentDeliveryInput {
  documentType: DocumentType;
  documentId: string;
  eventType?: DeliveryEventType;
  templateKey?: DeliveryTemplateKey;
  recipient: string;
  recipientName?: string | null;
  subject?: string | null;
  message?: string | null;
}

export interface RetryDocumentDeliveryInput {
  companyId: string;
  deliveryId: string;
}

// New Group 10 tables are intentionally queried through an untyped adapter until
// the generated Supabase types are refreshed for this schema revision.
type UntypedRelation = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const supabaseUntyped = supabase as unknown as {
  from: (relation: string) => UntypedRelation;
};

function mapDelivery(row: Record<string, unknown>): DocumentDelivery {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    document_type: row.document_type as DocumentType,
    document_id: String(row.document_id),
    document_number: row.document_number ? String(row.document_number) : null,
    channel: String(row.channel ?? "email"),
    event_type: String(row.event_type ?? "send"),
    recipient: row.recipient ? String(row.recipient) : null,
    recipient_name: row.recipient_name ? String(row.recipient_name) : null,
    subject: row.subject ? String(row.subject) : null,
    message: row.message ? String(row.message) : null,
    template_key: row.template_key ? String(row.template_key) : null,
    status: String(row.status ?? "pending"),
    error: row.error ? String(row.error) : null,
    provider_message_id: row.provider_message_id ? String(row.provider_message_id) : null,
    provider_name: row.provider_name ? String(row.provider_name) : null,
    sent_by: row.sent_by ? String(row.sent_by) : null,
    sent_at: String(row.sent_at),
    send_mode: row.send_mode ? String(row.send_mode) : null,
    stage_key: row.stage_key ? String(row.stage_key) : null,
    last_event_type: row.last_event_type ? String(row.last_event_type) : null,
    last_event_at: row.last_event_at ? String(row.last_event_at) : null,
    last_event_summary: row.last_event_summary ? String(row.last_event_summary) : null,
    last_error_kind: row.last_error_kind ? String(row.last_error_kind) : null,
    attempt_count: Number(row.attempt_count ?? 0),
    last_attempt_at: row.last_attempt_at ? String(row.last_attempt_at) : null,
    next_retry_at: row.next_retry_at ? String(row.next_retry_at) : null,
    delivered_at: row.delivered_at ? String(row.delivered_at) : null,
    bounced_at: row.bounced_at ? String(row.bounced_at) : null,
    rejected_at: row.rejected_at ? String(row.rejected_at) : null,
    complained_at: row.complained_at ? String(row.complained_at) : null,
    opened_at: row.opened_at ? String(row.opened_at) : null,
    clicked_at: row.clicked_at ? String(row.clicked_at) : null,
    suppressed_at: row.suppressed_at ? String(row.suppressed_at) : null,
    source_href: row.source_href ? String(row.source_href) : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
  };
}

export function useDocumentDeliveries(documentType: DocumentType, documentId: string | undefined) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["document-deliveries", companyId, documentType, documentId],
    enabled: !!companyId && !!documentId,
    queryFn: async (): Promise<DocumentDelivery[]> => {
      const { data, error } = await supabaseUntyped
        .from("document_deliveries")
        .select("*")
        .eq("company_id", companyId!)
        .eq("document_type", documentType)
        .eq("document_id", documentId!)
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => mapDelivery(row));
    },
  });
}

export function useDocumentDeliveryEvents(deliveryId: string | undefined) {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["document-delivery-events", companyId, deliveryId],
    enabled: !!companyId && !!deliveryId,
    queryFn: async (): Promise<DocumentDeliveryEvent[]> => {
      const { data, error } = await supabaseUntyped
        .from("document_delivery_events")
        .select("*")
        .eq("company_id", companyId!)
        .eq("delivery_id", deliveryId!)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        delivery_id: String(row.delivery_id),
        provider_name: String(row.provider_name ?? "resend"),
        provider_message_id: row.provider_message_id ? String(row.provider_message_id) : null,
        event_type: String(row.event_type ?? ""),
        severity: String(row.severity ?? "info"),
        summary: row.summary ? String(row.summary) : null,
        occurred_at: String(row.occurred_at),
        payload:
          row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
            ? (row.payload as Record<string, unknown>)
            : {},
      }));
    },
  });
}

export function useDeliveryTemplates() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["delivery-templates", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabaseUntyped
        .from("document_email_templates")
        .select("id, company_id, template_key, label, subject_template, body_template, payment_instructions")
        .eq("company_id", companyId!)
        .order("template_key");
      if (error) throw error;
      return mergeDeliveryTemplates((data ?? []) as Partial<DeliveryTemplateRecord>[]);
    },
    placeholderData: () => mergeDeliveryTemplates(listDeliveryTemplateDefaults()),
  });
}

export function useUpsertDeliveryTemplate() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      templateKey: DeliveryTemplateKey;
      label: string;
      subjectTemplate: string;
      bodyTemplate: string;
      paymentInstructions?: string | null;
    }) => {
      if (!companyId) throw new Error("Missing company");
      const { error } = await supabaseUntyped.from("document_email_templates").upsert(
        {
          company_id: companyId,
          template_key: input.templateKey,
          label: input.label,
          subject_template: input.subjectTemplate,
          body_template: input.bodyTemplate,
          payment_instructions: input.paymentInstructions ?? null,
          updated_by: user?.id ?? null,
          created_by: user?.id ?? null,
        },
        { onConflict: "company_id,template_key" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-templates"] });
    },
  });
}

export function useSendDocumentDelivery() {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (input: SendDocumentDeliveryInput) =>
      apiJson<{ deliveryId: string; status: string; shareUrl: string | null }>(
        "/api/communications/send",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSettled: (_result, _error, variables) => {
      qc.invalidateQueries({
        queryKey: ["document-deliveries", companyId, variables.documentType, variables.documentId],
      });
    },
  });
}

export function useRetryDocumentDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RetryDocumentDeliveryInput) =>
      apiJson<{ deliveryId: string; status: string }>("/api/communications/retry", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["document-deliveries"] });
      qc.invalidateQueries({ queryKey: ["document-delivery-events"] });
      qc.invalidateQueries({ queryKey: ["collections-dashboard"] });
    },
  });
}
