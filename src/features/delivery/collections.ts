import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { apiJson } from "@/lib/api";
import type { DeliveryTemplateKey } from "@/features/delivery/templates";

type UntypedRelation = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const supabaseUntyped = supabase as unknown as {
  from: (relation: string) => UntypedRelation;
};

export type DeliveryStageKey = "invoice" | "friendly" | "overdue" | "final" | "statement";

export interface CollectionPolicy {
  id: string;
  company_id: string;
  auto_reminders_enabled: boolean;
  auto_statements_enabled: boolean;
  friendly_before_due_days: number;
  overdue_after_due_days: number;
  final_after_due_days: number;
  statement_run_day: number;
  throttle_days: number;
  retry_delay_minutes: number;
  max_retry_attempts: number;
  batch_limit: number;
  sender_display_name: string | null;
  default_reply_to: string | null;
  invoice_template_key: DeliveryTemplateKey;
  friendly_template_key: DeliveryTemplateKey;
  overdue_template_key: DeliveryTemplateKey;
  final_template_key: DeliveryTemplateKey;
  statement_template_key: DeliveryTemplateKey;
}

export interface DeliverySuppression {
  id: string;
  company_id: string;
  email: string;
  email_normalized: string;
  scope: string;
  reason: string | null;
  source: string;
  is_active: boolean;
  created_at: string;
}

export interface CollectionQueueItem {
  id: string;
  documentType: "invoice" | "customer_statement";
  documentId: string;
  documentNumber: string;
  customerId: string;
  customerName: string;
  recipient: string | null;
  balanceDue: number;
  dueDate: string | null;
  issueDate: string;
  daysOverdue: number;
  agingBucket: "current" | "1-30" | "31-60" | "61+";
  lastContactAt: string | null;
  lastContactSummary: string | null;
  reminderStage: DeliveryStageKey | null;
  targetStage: DeliveryStageKey | null;
  targetTemplateKey: DeliveryTemplateKey | null;
  nextActionAt: string | null;
  readyNow: boolean;
  sendable: boolean;
  skipReason: string | null;
  sourceHref: string;
}

export interface BatchPreviewResult {
  kind: "reminders" | "statements";
  asOf: string;
  total: number;
  sendable: number;
  skipped: number;
  items: CollectionQueueItem[];
}

export interface CollectionsDashboardData {
  asOf: string;
  totalOverdueAmount: number;
  readyNowCount: number;
  readyNowAmount: number;
  failedDeliveries: number;
  aging: Array<{
    key: "current" | "1-30" | "31-60" | "61+";
    label: string;
    count: number;
    amount: number;
  }>;
  items: CollectionQueueItem[];
  failedQueue: Array<{
    deliveryId: string;
    documentNumber: string;
    recipient: string | null;
    status: string;
    error: string | null;
    nextRetryAt: string | null;
    lastEventSummary: string | null;
    sourceHref: string | null;
  }>;
}

function mapPolicy(row: Record<string, unknown>): CollectionPolicy {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    auto_reminders_enabled: Boolean(row.auto_reminders_enabled),
    auto_statements_enabled: Boolean(row.auto_statements_enabled),
    friendly_before_due_days: Number(row.friendly_before_due_days ?? 3),
    overdue_after_due_days: Number(row.overdue_after_due_days ?? 3),
    final_after_due_days: Number(row.final_after_due_days ?? 10),
    statement_run_day: Number(row.statement_run_day ?? 1),
    throttle_days: Number(row.throttle_days ?? 4),
    retry_delay_minutes: Number(row.retry_delay_minutes ?? 30),
    max_retry_attempts: Number(row.max_retry_attempts ?? 5),
    batch_limit: Number(row.batch_limit ?? 100),
    sender_display_name: row.sender_display_name ? String(row.sender_display_name) : null,
    default_reply_to: row.default_reply_to ? String(row.default_reply_to) : null,
    invoice_template_key: String(row.invoice_template_key ?? "invoice_email") as DeliveryTemplateKey,
    friendly_template_key: String(row.friendly_template_key ?? "reminder_friendly") as DeliveryTemplateKey,
    overdue_template_key: String(row.overdue_template_key ?? "reminder_overdue") as DeliveryTemplateKey,
    final_template_key: String(row.final_template_key ?? "reminder_final") as DeliveryTemplateKey,
    statement_template_key: String(row.statement_template_key ?? "customer_statement") as DeliveryTemplateKey,
  };
}

export function useCollectionPolicy() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["collection-policy", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<CollectionPolicy | null> => {
      const { data, error } = await supabaseUntyped
        .from("company_collection_policies")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapPolicy(data as Record<string, unknown>) : null;
    },
  });
}

export function useUpdateCollectionPolicy() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<CollectionPolicy>) => {
      if (!companyId) throw new Error("Missing company");
      const payload = {
        company_id: companyId,
        ...patch,
        updated_by: user?.id ?? null,
        created_by: user?.id ?? null,
      };
      const { error } = await supabaseUntyped
        .from("company_collection_policies")
        .upsert(payload, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-policy"] });
    },
  });
}

export function useDeliverySuppressions() {
  const { companyId } = useAuth();
  return useQuery({
    queryKey: ["delivery-suppressions", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<DeliverySuppression[]> => {
      const { data, error } = await supabaseUntyped
        .from("document_delivery_suppressions")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        company_id: String(row.company_id),
        email: String(row.email ?? ""),
        email_normalized: String(row.email_normalized ?? ""),
        scope: String(row.scope ?? "all"),
        reason: row.reason ? String(row.reason) : null,
        source: String(row.source ?? "manual"),
        is_active: Boolean(row.is_active ?? true),
        created_at: String(row.created_at),
      }));
    },
  });
}

export function useUpsertDeliverySuppression() {
  const qc = useQueryClient();
  const { companyId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: { email: string; reason?: string | null; isActive?: boolean }) => {
      if (!companyId) throw new Error("Missing company");
      const normalized = input.email.trim().toLowerCase();
      const { error } = await supabaseUntyped.from("document_delivery_suppressions").upsert(
        {
          company_id: companyId,
          email: input.email.trim(),
          email_normalized: normalized,
          scope: "all",
          reason: input.reason?.trim() || null,
          source: "manual",
          is_active: input.isActive ?? true,
          created_by: user?.id ?? null,
        },
        { onConflict: "company_id,email_normalized,scope" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-suppressions"] });
      qc.invalidateQueries({ queryKey: ["collections-dashboard"] });
    },
  });
}

export function useToggleDeliverySuppression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) => {
      const { error } = await supabaseUntyped
        .from("document_delivery_suppressions")
        .update({ is_active: input.isActive })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-suppressions"] });
      qc.invalidateQueries({ queryKey: ["collections-dashboard"] });
    },
  });
}

export function useCollectionsDashboard(params: { search?: string; stage?: string }) {
  const { companyId } = useAuth();
  const searchParams = new URLSearchParams();
  if (companyId) searchParams.set("companyId", companyId);
  if (params.search) searchParams.set("search", params.search);
  if (params.stage) searchParams.set("stage", params.stage);

  return useQuery({
    queryKey: ["collections-dashboard", companyId, params.search, params.stage],
    enabled: !!companyId,
    queryFn: async (): Promise<CollectionsDashboardData> =>
      apiJson(`/api/collections/dashboard?${searchParams.toString()}`),
  });
}

export function usePreviewCollectionsBatch() {
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      kind: "reminders" | "statements";
      search?: string | null;
      readyOnly?: boolean;
      stageOverride?: DeliveryStageKey | null;
    }): Promise<BatchPreviewResult> =>
      apiJson("/api/communications/batch-preview", {
        method: "POST",
        body: JSON.stringify({
          companyId,
          ...input,
        }),
      }),
  });
}

export function useSendCollectionsBatch() {
  const qc = useQueryClient();
  const { companyId } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      kind: "reminders" | "statements";
      search?: string | null;
      readyOnly?: boolean;
      stageOverride?: DeliveryStageKey | null;
    }) =>
      apiJson<{
        queued: number;
        processed: number;
        sent: number;
        failed: number;
        suppressed: number;
        preview: BatchPreviewResult;
      }>("/api/communications/batch-send", {
        method: "POST",
        body: JSON.stringify({
          companyId,
          ...input,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections-dashboard"] });
      qc.invalidateQueries({ queryKey: ["document-deliveries"] });
      qc.invalidateQueries({ queryKey: ["document-delivery-events"] });
    },
  });
}
