import { createHash } from "node:crypto";
import { Webhook } from "svix";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildSharedDocumentUrl,
  createDocumentShareToken,
  fmtDate,
  fmtMoney,
} from "@/routes/-api.documents.shared";
import {
  loadCustomerStatementDocument,
  loadDeliveryContext,
  type CustomerStatementData,
  type DeliveryContext,
  type DeliveryDocumentType,
  type DeliveryEventType,
} from "@/features/delivery/server";
import {
  renderDeliveryTemplate,
  type DeliveryTemplateKey,
  type DeliveryTemplateRecord,
} from "@/features/delivery/templates";

type UntypedAdminRelation = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const adminUntyped = supabaseAdmin as unknown as {
  from: (relation: string) => UntypedAdminRelation;
};

export type DeliverySendMode = "manual" | "batch" | "automated" | "retry";
export type DeliveryStageKey = "invoice" | "friendly" | "overdue" | "final" | "statement";
export type DeliveryStatus =
  | "pending"
  | "processing"
  | "sent"
  | "delivered"
  | "failed"
  | "rejected"
  | "bounced"
  | "complained"
  | "suppressed";

interface CompanyRecord {
  id: string;
  name: string;
  legal_name: string | null;
  currency: string;
  country: string | null;
}

export interface CollectionPolicy {
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

export interface DeliveryEventView {
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

interface DeliveryRecord {
  id: string;
  company_id: string;
  document_type: DeliveryDocumentType;
  document_id: string;
  document_number: string | null;
  event_type: string;
  stage_key: string | null;
  template_key: string | null;
  recipient: string | null;
  recipient_email_normalized: string | null;
  recipient_name: string | null;
  subject: string | null;
  message: string | null;
  status: string;
  error: string | null;
  provider_message_id: string | null;
  provider_name: string | null;
  sent_by: string | null;
  sent_at: string;
  send_mode: string | null;
  dedupe_key: string | null;
  source_href: string | null;
  metadata: Record<string, unknown>;
  attempt_count: number;
  next_retry_at: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
  last_event_summary: string | null;
}

function num(value: unknown) {
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

function isEmailLike(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  return !!normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysIso(base: string, days: number) {
  const date = new Date(`${base}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function diffDays(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  return Math.floor((end - start) / 86_400_000);
}

function stageOrder(stage: DeliveryStageKey | null) {
  switch (stage) {
    case "friendly":
      return 1;
    case "overdue":
      return 2;
    case "final":
      return 3;
    case "statement":
      return 4;
    default:
      return 0;
  }
}

function stageTemplateKey(
  policy: CollectionPolicy,
  stage: DeliveryStageKey,
): DeliveryTemplateKey {
  switch (stage) {
    case "friendly":
      return policy.friendly_template_key;
    case "overdue":
      return policy.overdue_template_key;
    case "final":
      return policy.final_template_key;
    case "statement":
      return policy.statement_template_key;
    default:
      return policy.invoice_template_key;
  }
}

function reminderLevelLabel(stage: DeliveryStageKey | null) {
  switch (stage) {
    case "friendly":
      return "friendly";
    case "overdue":
      return "overdue";
    case "final":
      return "final";
    default:
      return "invoice";
  }
}

function eventSeverity(eventType: string) {
  if (eventType.includes("bounced") || eventType.includes("complained")) return "danger";
  if (eventType.includes("failed") || eventType.includes("suppressed")) return "warning";
  return "info";
}

function withSenderName(from: string, displayName: string | null | undefined) {
  const name = displayName?.trim();
  if (!name) return from;

  const match = from.match(/<([^>]+)>/);
  const email = match ? match[1] : from.trim();
  return `${name} <${email}>`;
}

function computeRetryAt(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function classifySendError(error: unknown): { kind: "transient" | "permanent"; message: string } {
  const message = error instanceof Error ? error.message : "Email send failed";
  const normalized = message.toLowerCase();
  const transient =
    normalized.includes("429") ||
    normalized.includes("timeout") ||
    normalized.includes("tempor") ||
    normalized.includes("network") ||
    normalized.includes("503") ||
    normalized.includes("502") ||
    normalized.includes("504") ||
    normalized.includes("rate limit");
  return {
    kind: transient ? "transient" : "permanent",
    message,
  };
}

async function loadCompany(companyId: string): Promise<CompanyRecord> {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id, name, legal_name, currency, country")
    .eq("id", companyId)
    .maybeSingle();
  if (error || !data) throw new Error("Company not found");
  return {
    id: data.id,
    name: data.name,
    legal_name: data.legal_name ?? null,
    currency: data.currency ?? "USD",
    country: data.country ?? null,
  };
}

async function loadTemplateOverrides(companyId: string) {
  const { data, error } = await adminUntyped
    .from("document_email_templates")
    .select("template_key, label, subject_template, body_template, payment_instructions")
    .eq("company_id", companyId);
  if (error) throw new Error(error.message ?? "Failed to load document delivery templates");
  return (data ?? []) as Partial<DeliveryTemplateRecord>[];
}

async function insertAuditLog({
  companyId,
  actorId,
  recordId,
  action,
  documentType,
  documentNumber,
  summary,
  metadata,
}: {
  companyId: string;
  actorId: string | null;
  recordId: string;
  action: string;
  documentType: string;
  documentNumber: string;
  summary: string;
  metadata: Record<string, unknown>;
}) {
  await adminUntyped.from("audit_logs").insert({
    company_id: companyId,
    actor_id: actorId,
    table_name: "document_deliveries",
    record_id: recordId,
    action,
    entity_type: documentType,
    entity_number: documentNumber,
    summary,
    metadata,
    after: metadata,
  });
}

function renderEmailShell({
  company,
  title,
  body,
  summaryRows,
  ctaUrl,
  ctaLabel,
}: {
  company: CompanyRecord;
  title: string;
  body: string;
  summaryRows: Array<{ label: string; value: string }>;
  ctaUrl: string;
  ctaLabel: string;
}) {
  const summaryHtml =
    summaryRows.length === 0
      ? ""
      : `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; margin:18px 0;">
          ${summaryRows
            .map(
              (row) => `<tr>
                <td style="padding:6px 0; color:#6b7280; font-size:13px;">${row.label}</td>
                <td style="padding:6px 0; text-align:right; font-size:13px; color:#111827; font-weight:600;">${row.value}</td>
              </tr>`,
            )
            .join("")}
        </table>`;

  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeBody = body
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 14px;">${block.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")}</p>`)
    .join("");

  return `<!doctype html>
<html lang="en">
  <body style="margin:0; background:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#111827;">
    <div style="max-width:640px; margin:0 auto; padding:28px 16px;">
      <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; overflow:hidden;">
        <div style="padding:24px 28px; border-bottom:1px solid #e5e7eb;">
          <div style="font-size:20px; font-weight:700;">${(company.legal_name || company.name).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          <div style="margin-top:4px; color:#6b7280; font-size:13px;">${(company.country || "Finance documents").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>
        <div style="padding:28px;">
          <h1 style="margin:0 0 16px; font-size:20px;">${safeTitle}</h1>
          ${safeBody}
          ${summaryHtml}
          <div style="margin-top:22px;">
            <a href="${ctaUrl}" style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:11px 16px; border-radius:8px; font-weight:600;">
              ${ctaLabel}
            </a>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function sendEmail({
  to,
  subject,
  html,
  text,
  senderDisplayName,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  senderDisplayName?: string | null;
  replyTo?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM_ADDRESS?.trim();
  const defaultReplyTo = process.env.MAIL_REPLY_TO?.trim();

  if (!apiKey || !from) {
    throw new Error(
      "Email delivery is not configured. Set RESEND_API_KEY and MAIL_FROM_ADDRESS to enable sends.",
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "AtlasERP/1.0",
    },
    body: JSON.stringify({
      from: withSenderName(from, senderDisplayName),
      to: [to],
      subject,
      html,
      text,
      reply_to: replyTo?.trim() ? [replyTo.trim()] : defaultReplyTo ? [defaultReplyTo] : undefined,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; message?: string }
    | null;
  if (!response.ok) {
    throw new Error(payload?.message || `Email provider error (${response.status})`);
  }

  return {
    providerMessageId: payload?.id ?? null,
  };
}

async function loadCollectionPolicy(companyId: string): Promise<CollectionPolicy> {
  const { data, error } = await adminUntyped
    .from("company_collection_policies")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Failed to load collections policy");
  const row = safeRecord(data);
  return {
    company_id: companyId,
    auto_reminders_enabled: Boolean(row.auto_reminders_enabled ?? true),
    auto_statements_enabled: Boolean(row.auto_statements_enabled ?? false),
    friendly_before_due_days: num(row.friendly_before_due_days) || 3,
    overdue_after_due_days: num(row.overdue_after_due_days) || 3,
    final_after_due_days: num(row.final_after_due_days) || 10,
    statement_run_day: num(row.statement_run_day) || 1,
    throttle_days: num(row.throttle_days) || 4,
    retry_delay_minutes: num(row.retry_delay_minutes) || 30,
    max_retry_attempts: num(row.max_retry_attempts) || 5,
    batch_limit: num(row.batch_limit) || 100,
    sender_display_name:
      typeof row.sender_display_name === "string" ? row.sender_display_name : null,
    default_reply_to:
      typeof row.default_reply_to === "string" ? row.default_reply_to : null,
    invoice_template_key: (row.invoice_template_key as DeliveryTemplateKey) || "invoice_email",
    friendly_template_key:
      (row.friendly_template_key as DeliveryTemplateKey) || "reminder_friendly",
    overdue_template_key:
      (row.overdue_template_key as DeliveryTemplateKey) || "reminder_overdue",
    final_template_key: (row.final_template_key as DeliveryTemplateKey) || "reminder_final",
    statement_template_key:
      (row.statement_template_key as DeliveryTemplateKey) || "customer_statement",
  };
}

async function loadSuppressions(companyId: string) {
  const { data, error } = await adminUntyped
    .from("document_delivery_suppressions")
    .select("email, email_normalized, reason, scope")
    .eq("company_id", companyId)
    .eq("is_active", true);
  if (error) throw new Error(error.message ?? "Failed to load delivery suppressions");
  const map = new Map<string, { reason: string | null; scope: string }>();
  for (const row of data ?? []) {
    const normalized = normalizeEmail(row.email_normalized ?? row.email);
    if (!normalized) continue;
    map.set(normalized, {
      reason: typeof row.reason === "string" ? row.reason : null,
      scope: typeof row.scope === "string" ? row.scope : "all",
    });
  }
  return map;
}

async function upsertSuppression({
  companyId,
  email,
  source,
  reason,
}: {
  companyId: string;
  email: string;
  source: string;
  reason: string | null;
}) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  await adminUntyped.from("document_delivery_suppressions").upsert(
    {
      company_id: companyId,
      email,
      email_normalized: normalized,
      scope: "all",
      reason,
      source,
      is_active: true,
    },
    { onConflict: "company_id,email_normalized,scope" },
  );
}

function stageFromTemplateKey(templateKey: string | null | undefined): DeliveryStageKey | null {
  switch (templateKey) {
    case "reminder_friendly":
      return "friendly";
    case "reminder_overdue":
      return "overdue";
    case "reminder_final":
      return "final";
    case "customer_statement":
      return "statement";
    case "invoice_email":
      return "invoice";
    default:
      return null;
  }
}

function detectReminderStage(
  policy: CollectionPolicy,
  dueDate: string | null,
  asOf: string,
): { stage: DeliveryStageKey | null; nextActionAt: string | null } {
  if (!dueDate) return { stage: null, nextActionAt: null };
  const daysOverdue = diffDays(dueDate, asOf);
  const friendlyDate = addDaysIso(dueDate, -policy.friendly_before_due_days);
  const overdueDate = addDaysIso(dueDate, policy.overdue_after_due_days);
  const finalDate = addDaysIso(dueDate, policy.final_after_due_days);

  if (daysOverdue >= policy.final_after_due_days) {
    return { stage: "final", nextActionAt: finalDate };
  }
  if (daysOverdue >= policy.overdue_after_due_days) {
    return { stage: "overdue", nextActionAt: overdueDate };
  }
  if (asOf >= friendlyDate) {
    return { stage: "friendly", nextActionAt: friendlyDate };
  }
  return { stage: null, nextActionAt: friendlyDate };
}

function agingBucket(daysOverdue: number): "current" | "1-30" | "31-60" | "61+" {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1-30";
  if (daysOverdue <= 60) return "31-60";
  return "61+";
}

async function loadInvoiceCollectionRows(companyId: string) {
  const { data, error } = await adminUntyped
    .from("customer_invoices")
    .select("id, customer_id, invoice_number, issue_date, due_date, total, amount_paid, currency, status, customers(id, name, email)")
    .eq("company_id", companyId)
    .neq("status", "draft")
    .neq("status", "cancelled");
  if (error) throw new Error(error.message ?? "Failed to load invoices for collections");
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function loadInvoiceDeliveryHistory(companyId: string, invoiceIds: string[]) {
  if (invoiceIds.length === 0) return [] as DeliveryRecord[];
  const { data, error } = await adminUntyped
    .from("document_deliveries")
    .select("*")
    .eq("company_id", companyId)
    .eq("document_type", "invoice")
    .in("document_id", invoiceIds)
    .order("sent_at", { ascending: false });
  if (error) throw new Error(error.message ?? "Failed to load invoice delivery history");
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    company_id: String(row.company_id),
    document_type: row.document_type as DeliveryDocumentType,
    document_id: String(row.document_id),
    document_number: row.document_number ? String(row.document_number) : null,
    event_type: String(row.event_type ?? "send"),
    stage_key: row.stage_key ? String(row.stage_key) : null,
    template_key: row.template_key ? String(row.template_key) : null,
    recipient: row.recipient ? String(row.recipient) : null,
    recipient_email_normalized: row.recipient_email_normalized
      ? String(row.recipient_email_normalized)
      : null,
    recipient_name: row.recipient_name ? String(row.recipient_name) : null,
    subject: row.subject ? String(row.subject) : null,
    message: row.message ? String(row.message) : null,
    status: String(row.status ?? "pending"),
    error: row.error ? String(row.error) : null,
    provider_message_id: row.provider_message_id ? String(row.provider_message_id) : null,
    provider_name: row.provider_name ? String(row.provider_name) : null,
    sent_by: row.sent_by ? String(row.sent_by) : null,
    sent_at: String(row.sent_at),
    send_mode: row.send_mode ? String(row.send_mode) : null,
    dedupe_key: row.dedupe_key ? String(row.dedupe_key) : null,
    source_href: row.source_href ? String(row.source_href) : null,
    metadata: safeRecord(row.metadata),
    attempt_count: num(row.attempt_count),
    next_retry_at: row.next_retry_at ? String(row.next_retry_at) : null,
    last_event_type: row.last_event_type ? String(row.last_event_type) : null,
    last_event_at: row.last_event_at ? String(row.last_event_at) : null,
    last_event_summary: row.last_event_summary ? String(row.last_event_summary) : null,
  }));
}

async function loadStatementHistory(companyId: string, customerIds: string[]) {
  if (customerIds.length === 0) return [] as DeliveryRecord[];
  const { data, error } = await adminUntyped
    .from("document_deliveries")
    .select("*")
    .eq("company_id", companyId)
    .eq("document_type", "customer_statement")
    .in("document_id", customerIds)
    .order("sent_at", { ascending: false });
  if (error) throw new Error(error.message ?? "Failed to load statement history");
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    company_id: String(row.company_id),
    document_type: row.document_type as DeliveryDocumentType,
    document_id: String(row.document_id),
    document_number: row.document_number ? String(row.document_number) : null,
    event_type: String(row.event_type ?? "statement"),
    stage_key: row.stage_key ? String(row.stage_key) : null,
    template_key: row.template_key ? String(row.template_key) : null,
    recipient: row.recipient ? String(row.recipient) : null,
    recipient_email_normalized: row.recipient_email_normalized
      ? String(row.recipient_email_normalized)
      : null,
    recipient_name: row.recipient_name ? String(row.recipient_name) : null,
    subject: row.subject ? String(row.subject) : null,
    message: row.message ? String(row.message) : null,
    status: String(row.status ?? "pending"),
    error: row.error ? String(row.error) : null,
    provider_message_id: row.provider_message_id ? String(row.provider_message_id) : null,
    provider_name: row.provider_name ? String(row.provider_name) : null,
    sent_by: row.sent_by ? String(row.sent_by) : null,
    sent_at: String(row.sent_at),
    send_mode: row.send_mode ? String(row.send_mode) : null,
    dedupe_key: row.dedupe_key ? String(row.dedupe_key) : null,
    source_href: row.source_href ? String(row.source_href) : null,
    metadata: safeRecord(row.metadata),
    attempt_count: num(row.attempt_count),
    next_retry_at: row.next_retry_at ? String(row.next_retry_at) : null,
    last_event_type: row.last_event_type ? String(row.last_event_type) : null,
    last_event_at: row.last_event_at ? String(row.last_event_at) : null,
    last_event_summary: row.last_event_summary ? String(row.last_event_summary) : null,
  }));
}

function isTerminalSuccess(status: string) {
  return status === "sent" || status === "delivered";
}

function shouldSkipBecauseRecentlySent(sentAt: string | null, minDays: number, asOf: string) {
  if (!sentAt) return false;
  const sentDate = sentAt.slice(0, 10);
  return diffDays(sentDate, asOf) < minDays;
}

export async function previewReminderBatch({
  companyId,
  asOf = toIsoDate(new Date()),
  stageOverride,
  search,
  readyOnly = false,
}: {
  companyId: string;
  asOf?: string;
  stageOverride?: DeliveryStageKey | null;
  search?: string | null;
  readyOnly?: boolean;
}): Promise<BatchPreviewResult> {
  const policy = await loadCollectionPolicy(companyId);
  const suppressions = await loadSuppressions(companyId);
  const invoiceRows = await loadInvoiceCollectionRows(companyId);
  const invoiceIds = invoiceRows.map((row) => String(row.id));
  const history = await loadInvoiceDeliveryHistory(companyId, invoiceIds);
  const historyByInvoice = new Map<string, DeliveryRecord[]>();
  for (const row of history) {
    const current = historyByInvoice.get(row.document_id) ?? [];
    current.push(row);
    historyByInvoice.set(row.document_id, current);
  }

  const query = search?.trim().toLowerCase() || "";
  const items: CollectionQueueItem[] = [];

  for (const row of invoiceRows) {
    const customer = safeRecord(row.customers);
    const balanceDue = Math.max(0, num(row.total) - num(row.amount_paid));
    if (balanceDue <= 0.005) continue;

    const dueDate = typeof row.due_date === "string" ? row.due_date : null;
    const computed = detectReminderStage(policy, dueDate, asOf);
    const targetStage = stageOverride ?? computed.stage;
    const invoiceHistory = historyByInvoice.get(String(row.id)) ?? [];
    const lastContact = invoiceHistory[0] ?? null;
    const lastReminder = invoiceHistory.find((entry) => entry.event_type === "reminder") ?? null;
    const lastStage = lastReminder
      ? (lastReminder.stage_key as DeliveryStageKey | null) ?? stageFromTemplateKey(lastReminder.template_key)
      : null;
    const recipient = normalizeEmail(typeof customer.email === "string" ? customer.email : null);
    const skipReason =
      !dueDate
        ? "No due date"
        : !targetStage
          ? "Not yet due for a reminder"
          : !recipient
            ? "Missing customer email"
            : !isEmailLike(recipient)
              ? "Invalid customer email"
              : suppressions.has(recipient)
                ? `Suppressed: ${suppressions.get(recipient)?.reason || "recipient opted out"}`
                : lastStage && stageOrder(lastStage) >= stageOrder(targetStage)
                  ? `Already reached ${reminderLevelLabel(lastStage)} stage`
                  : shouldSkipBecauseRecentlySent(lastReminder?.sent_at ?? null, policy.throttle_days, asOf)
                    ? `Last reminder sent ${lastReminder?.sent_at?.slice(0, 10)}`
                    : null;

    const daysOverdue = dueDate ? Math.max(0, diffDays(dueDate, asOf)) : 0;
    const item: CollectionQueueItem = {
      id: String(row.id),
      documentType: "invoice",
      documentId: String(row.id),
      documentNumber: String(row.invoice_number),
      customerId: String(row.customer_id),
      customerName: String(customer.name ?? "Unknown"),
      recipient,
      balanceDue,
      dueDate,
      issueDate: String(row.issue_date),
      daysOverdue,
      agingBucket: agingBucket(daysOverdue),
      lastContactAt: lastContact?.sent_at ?? null,
      lastContactSummary: lastContact?.last_event_summary ?? lastContact?.subject ?? null,
      reminderStage: lastStage,
      targetStage,
      targetTemplateKey: targetStage ? stageTemplateKey(policy, targetStage) : null,
      nextActionAt: computed.nextActionAt,
      readyNow: !!targetStage && !skipReason && (!computed.nextActionAt || computed.nextActionAt <= asOf),
      sendable: !!targetStage && !skipReason,
      skipReason,
      sourceHref: `/invoices/${row.id}`,
    };

    if (
      query &&
      !item.documentNumber.toLowerCase().includes(query) &&
      !item.customerName.toLowerCase().includes(query) &&
      !(item.recipient ?? "").includes(query)
    ) {
      continue;
    }
    if (readyOnly && !item.readyNow) continue;
    items.push(item);
  }

  items.sort((a, b) => {
    if (a.readyNow !== b.readyNow) return a.readyNow ? -1 : 1;
    if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return a.documentNumber.localeCompare(b.documentNumber);
  });

  return {
    kind: "reminders",
    asOf,
    total: items.length,
    sendable: items.filter((item) => item.sendable).length,
    skipped: items.filter((item) => !item.sendable).length,
    items,
  };
}

export async function previewStatementBatch({
  companyId,
  asOf = toIsoDate(new Date()),
  search,
}: {
  companyId: string;
  asOf?: string;
  search?: string | null;
}): Promise<BatchPreviewResult> {
  const suppressions = await loadSuppressions(companyId);
  const { data: customers, error } = await adminUntyped
    .from("customers")
    .select("id, name, email, currency")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message ?? "Failed to load customers for statements");

  const customerIds = (customers ?? []).map((row: Record<string, unknown>) => String(row.id));
  const statementHistory = await loadStatementHistory(companyId, customerIds);
  const latestByCustomer = new Map<string, DeliveryRecord>();
  for (const row of statementHistory) {
    if (!latestByCustomer.has(row.document_id)) latestByCustomer.set(row.document_id, row);
  }

  const query = search?.trim().toLowerCase() || "";
  const items: CollectionQueueItem[] = [];

  for (const customer of (customers ?? []) as Array<Record<string, unknown>>) {
    const statement = await loadCustomerStatementDocument(String(customer.id));
    if (!statement) continue;
    if (statement.totalDue <= 0.005 && statement.availableCredit <= 0.005) continue;

    const recipient = normalizeEmail(statement.customer.email);
    const lastContact = latestByCustomer.get(statement.customer.id) ?? null;
    const sentThisMonth =
      lastContact?.sent_at?.slice(0, 7) === asOf.slice(0, 7) &&
      isTerminalSuccess(lastContact.status);
    const skipReason =
      !recipient
        ? "Missing customer email"
        : !isEmailLike(recipient)
          ? "Invalid customer email"
          : suppressions.has(recipient)
            ? `Suppressed: ${suppressions.get(recipient)?.reason || "recipient opted out"}`
            : sentThisMonth
              ? `Statement already sent ${lastContact?.sent_at?.slice(0, 10)}`
              : null;

    const item: CollectionQueueItem = {
      id: statement.customer.id,
      documentType: "customer_statement",
      documentId: statement.customer.id,
      documentNumber: statement.documentNumber,
      customerId: statement.customer.id,
      customerName: statement.customer.name,
      recipient,
      balanceDue: statement.totalDue,
      dueDate: null,
      issueDate: statement.documentDate,
      daysOverdue: 0,
      agingBucket: "current",
      lastContactAt: lastContact?.sent_at ?? null,
      lastContactSummary: lastContact?.last_event_summary ?? lastContact?.subject ?? null,
      reminderStage: null,
      targetStage: "statement",
      targetTemplateKey: "customer_statement",
      nextActionAt: asOf,
      readyNow: !skipReason,
      sendable: !skipReason,
      skipReason,
      sourceHref: `/customers/${statement.customer.id}`,
    };

    if (
      query &&
      !item.customerName.toLowerCase().includes(query) &&
      !item.documentNumber.toLowerCase().includes(query) &&
      !(item.recipient ?? "").includes(query)
    ) {
      continue;
    }
    items.push(item);
  }

  return {
    kind: "statements",
    asOf,
    total: items.length,
    sendable: items.filter((item) => item.sendable).length,
    skipped: items.filter((item) => !item.sendable).length,
    items,
  };
}

function metadataSummaryRows(context: DeliveryContext | CustomerStatementData) {
  return context.summaryRows.map((row) => ({ label: row.label, value: row.value }));
}

function eventLabel(eventType: DeliveryEventType, stageKey: DeliveryStageKey | null) {
  if (eventType === "statement") return "statement";
  if (stageKey === "friendly") return "friendly reminder";
  if (stageKey === "overdue") return "overdue reminder";
  if (stageKey === "final") return "final reminder";
  return "document email";
}

async function getExistingDedupedDelivery(companyId: string, dedupeKey: string) {
  const since = new Date(Date.now() - 45_000).toISOString();
  const { data, error } = await adminUntyped
    .from("document_deliveries")
    .select("id, status, metadata")
    .eq("company_id", companyId)
    .eq("dedupe_key", dedupeKey)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  if (!data?.id) return null;
  return {
    id: String(data.id),
    status: String(data.status ?? "pending"),
    shareUrl: safeRecord(data.metadata).share_url as string | null,
  };
}

async function insertDeliveryEvent({
  companyId,
  deliveryId,
  providerName,
  providerMessageId,
  eventType,
  summary,
  payload,
  occurredAt,
}: {
  companyId: string;
  deliveryId: string;
  providerName?: string | null;
  providerMessageId?: string | null;
  eventType: string;
  summary: string | null;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}) {
  await adminUntyped.from("document_delivery_events").insert({
    company_id: companyId,
    delivery_id: deliveryId,
    provider_name: providerName ?? "resend",
    provider_message_id: providerMessageId ?? null,
    event_type: eventType,
    severity: eventSeverity(eventType),
    summary,
    occurred_at: occurredAt ?? new Date().toISOString(),
    payload: payload ?? {},
  });
}

async function createDeliveryLog({
  request,
  userId,
  documentType,
  documentId,
  eventType,
  stageKey,
  templateKey,
  recipient,
  recipientName,
  subjectOverride,
  messageOverride,
  sendMode,
  scheduledFor,
  forceNew,
}: {
  request: Request;
  userId: string | null;
  documentType: DeliveryDocumentType;
  documentId: string;
  eventType: DeliveryEventType;
  stageKey: DeliveryStageKey | null;
  templateKey?: DeliveryTemplateKey;
  recipient: string | null;
  recipientName?: string | null;
  subjectOverride?: string | null;
  messageOverride?: string | null;
  sendMode: DeliverySendMode;
  scheduledFor?: string | null;
  forceNew?: boolean;
}) {
  const context = await loadDeliveryContext(documentType, documentId);
  if (!context) throw new Error("Document not found.");

  const policy = await loadCollectionPolicy(context.companyId);
  const suppressions = await loadSuppressions(context.companyId);
  const resolvedTemplateKey =
    templateKey ??
    (stageKey ? stageTemplateKey(policy, stageKey) : eventType === "statement" ? "customer_statement" : "invoice_email");

  const overrides = await loadTemplateOverrides(context.companyId);
  const shareToken = await createDocumentShareToken({
    companyId: context.companyId,
    documentType,
    documentId,
    createdBy: userId,
    expiresInDays: documentType === "customer_statement" ? 7 : 14,
  });
  const shareUrl = buildSharedDocumentUrl(request, context.printPath, shareToken.token);
  const normalizedRecipient = normalizeEmail(recipient);

  const rendered = renderDeliveryTemplate(
    resolvedTemplateKey,
    {
      company_name: context.company.name,
      company_legal_name: context.company.legal_name,
      recipient_name: recipientName ?? context.recipientName,
      customer_name: context.recipientName,
      supplier_name: context.recipientName,
      document_label: context.documentLabel,
      document_number: context.documentNumber,
      document_date: fmtDate(context.documentDate),
      due_date: context.dueDate ? fmtDate(context.dueDate) : null,
      document_total: fmtMoney(context.documentTotal, context.currency),
      balance_due:
        context.balanceDue !== null ? fmtMoney(context.balanceDue, context.currency) : null,
      available_credit:
        "availableCredit" in context
          ? fmtMoney(context.availableCredit, context.currency)
          : null,
      statement_total_due:
        "totalDue" in context ? fmtMoney(context.totalDue, context.currency) : null,
      reminder_level: reminderLevelLabel(stageKey),
      document_url: shareUrl,
    },
    overrides,
  );

  const subject = subjectOverride?.trim() || rendered.subject;
  const message = messageOverride?.trim() || rendered.body;
  const dedupeKey = sha256(
    [
      context.companyId,
      documentType,
      documentId,
      eventType,
      stageKey ?? "",
      normalizedRecipient ?? "",
      subject,
      message,
    ].join("|"),
  );

  if (!forceNew) {
    const existing = await getExistingDedupedDelivery(context.companyId, dedupeKey);
    if (existing) {
      return {
        deliveryId: existing.id,
        shareUrl: existing.shareUrl,
        status: existing.status,
        queued: false,
        duplicate: true,
      };
    }
  }

  const suppressed = normalizedRecipient ? suppressions.get(normalizedRecipient) : null;
  const initialStatus: DeliveryStatus =
    !normalizedRecipient || !isEmailLike(normalizedRecipient)
      ? "rejected"
      : suppressed
        ? "suppressed"
        : "pending";
  const nowIso = new Date().toISOString();

  const metadata = {
    share_expires_at: shareToken.expiresAt,
    share_url: shareUrl,
    summary_rows: metadataSummaryRows(context),
    document_label: context.documentLabel,
    document_title: `${context.documentLabel[0].toUpperCase()}${context.documentLabel.slice(1)} ${context.documentNumber}`,
    source_href: context.sourceHref,
    send_mode: sendMode,
  };

  const { data: delivery, error: insertError } = await adminUntyped
    .from("document_deliveries")
    .insert({
      company_id: context.companyId,
      document_type: documentType,
      document_id: documentId,
      document_number: context.documentNumber,
      channel: "email",
      event_type: eventType,
      stage_key: stageKey,
      template_key: resolvedTemplateKey,
      recipient: normalizedRecipient,
      recipient_email_normalized: normalizedRecipient,
      recipient_name: recipientName ?? context.recipientName ?? null,
      subject,
      message,
      status: initialStatus,
      sent_by: userId,
      sent_at: nowIso,
      queued_at: nowIso,
      scheduled_for: scheduledFor ?? nowIso,
      share_token_id: shareToken.id,
      source_href: context.sourceHref,
      send_mode: sendMode,
      dedupe_key: dedupeKey,
      provider_name: "resend",
      metadata,
      last_event_type:
        initialStatus === "rejected"
          ? "invalid_recipient"
          : initialStatus === "suppressed"
            ? "suppressed"
            : "queued",
      last_event_at: nowIso,
      last_event_summary:
        initialStatus === "rejected"
          ? "Recipient email is missing or invalid."
          : initialStatus === "suppressed"
            ? `Suppressed: ${suppressed?.reason || "recipient opted out"}`
            : `Queued ${eventLabel(eventType, stageKey)} for delivery`,
      error:
        initialStatus === "rejected"
          ? "Recipient email is missing or invalid."
          : initialStatus === "suppressed"
            ? `Suppressed: ${suppressed?.reason || "recipient opted out"}`
            : null,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message ?? "Failed to create delivery log");
  const deliveryId = String(delivery.id);

  await insertDeliveryEvent({
    companyId: context.companyId,
    deliveryId,
    providerName: "resend",
    eventType:
      initialStatus === "rejected"
        ? "invalid_recipient"
        : initialStatus === "suppressed"
          ? "suppressed"
          : "queued",
    summary:
      initialStatus === "rejected"
        ? "Recipient email is missing or invalid."
        : initialStatus === "suppressed"
          ? `Suppressed: ${suppressed?.reason || "recipient opted out"}`
          : `Queued ${eventLabel(eventType, stageKey)} for delivery`,
    payload: metadata,
    occurredAt: nowIso,
  });

  if (initialStatus === "pending") {
    await adminUntyped.from("document_delivery_outbox").insert({
      company_id: context.companyId,
      delivery_id: deliveryId,
      send_mode: sendMode,
      status: "pending",
      dedupe_key: dedupeKey,
      attempt_count: 0,
      max_attempts: policy.max_retry_attempts,
      next_attempt_at: scheduledFor ?? nowIso,
    });
  }

  await insertAuditLog({
    companyId: context.companyId,
    actorId: userId,
    recordId: deliveryId,
    action: initialStatus === "pending" ? "queue_email" : initialStatus,
    documentType,
    documentNumber: context.documentNumber,
    summary:
      initialStatus === "pending"
        ? `Queued ${eventLabel(eventType, stageKey)} for ${context.documentNumber}`
        : `Skipped ${eventLabel(eventType, stageKey)} for ${context.documentNumber}`,
    metadata: {
      document_type: documentType,
      document_id: documentId,
      recipient: normalizedRecipient,
      event_type: eventType,
      stage_key: stageKey,
      template_key: resolvedTemplateKey,
      send_mode: sendMode,
      skip_reason:
        initialStatus === "rejected"
          ? "invalid_recipient"
          : initialStatus === "suppressed"
            ? "suppressed"
            : null,
    },
  });

  return {
    deliveryId,
    shareUrl,
    status: initialStatus,
    queued: initialStatus === "pending",
    duplicate: false,
  };
}

async function loadDeliveryById(deliveryId: string): Promise<DeliveryRecord | null> {
  const { data, error } = await adminUntyped
    .from("document_deliveries")
    .select("*")
    .eq("id", deliveryId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Failed to load delivery");
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    document_type: row.document_type as DeliveryDocumentType,
    document_id: String(row.document_id),
    document_number: row.document_number ? String(row.document_number) : null,
    event_type: String(row.event_type ?? "send"),
    stage_key: row.stage_key ? String(row.stage_key) : null,
    template_key: row.template_key ? String(row.template_key) : null,
    recipient: row.recipient ? String(row.recipient) : null,
    recipient_email_normalized: row.recipient_email_normalized
      ? String(row.recipient_email_normalized)
      : null,
    recipient_name: row.recipient_name ? String(row.recipient_name) : null,
    subject: row.subject ? String(row.subject) : null,
    message: row.message ? String(row.message) : null,
    status: String(row.status ?? "pending"),
    error: row.error ? String(row.error) : null,
    provider_message_id: row.provider_message_id ? String(row.provider_message_id) : null,
    provider_name: row.provider_name ? String(row.provider_name) : null,
    sent_by: row.sent_by ? String(row.sent_by) : null,
    sent_at: String(row.sent_at),
    send_mode: row.send_mode ? String(row.send_mode) : null,
    dedupe_key: row.dedupe_key ? String(row.dedupe_key) : null,
    source_href: row.source_href ? String(row.source_href) : null,
    metadata: safeRecord(row.metadata),
    attempt_count: num(row.attempt_count),
    next_retry_at: row.next_retry_at ? String(row.next_retry_at) : null,
    last_event_type: row.last_event_type ? String(row.last_event_type) : null,
    last_event_at: row.last_event_at ? String(row.last_event_at) : null,
    last_event_summary: row.last_event_summary ? String(row.last_event_summary) : null,
  };
}

async function updateOutboxRow(
  deliveryId: string,
  patch: Record<string, unknown>,
) {
  await adminUntyped.from("document_delivery_outbox").update(patch).eq("delivery_id", deliveryId);
}

async function updateDeliveryRow(
  deliveryId: string,
  patch: Record<string, unknown>,
) {
  await adminUntyped.from("document_deliveries").update(patch).eq("id", deliveryId);
}

async function processQueuedDelivery(deliveryId: string, worker = "manual") {
  const delivery = await loadDeliveryById(deliveryId);
  if (!delivery) throw new Error("Delivery not found");
  if (!delivery.recipient_email_normalized) throw new Error("Recipient missing");

  const policy = await loadCollectionPolicy(delivery.company_id);
  const suppressions = await loadSuppressions(delivery.company_id);
  const nowIso = new Date().toISOString();
  const summaryRows = Array.isArray(delivery.metadata.summary_rows)
    ? (delivery.metadata.summary_rows as Array<{ label: string; value: string }>)
    : [];
  const shareUrl =
    typeof delivery.metadata.share_url === "string" ? delivery.metadata.share_url : null;
  const documentTitle =
    typeof delivery.metadata.document_title === "string"
      ? delivery.metadata.document_title
      : delivery.document_number ?? "Document";

  if (suppressions.has(delivery.recipient_email_normalized)) {
    const reason = suppressions.get(delivery.recipient_email_normalized)?.reason || "recipient opted out";
    await updateDeliveryRow(deliveryId, {
      status: "suppressed",
      error: `Suppressed: ${reason}`,
      suppressed_at: nowIso,
      last_event_type: "suppressed",
      last_event_at: nowIso,
      last_event_summary: `Suppressed: ${reason}`,
    });
    await updateOutboxRow(deliveryId, {
      status: "cancelled",
      processed_at: nowIso,
      last_error: `Suppressed: ${reason}`,
      last_error_kind: "suppressed",
      locked_at: null,
      locked_by: null,
    });
    await insertDeliveryEvent({
      companyId: delivery.company_id,
      deliveryId,
      providerName: delivery.provider_name ?? "resend",
      providerMessageId: delivery.provider_message_id,
      eventType: "suppressed",
      summary: `Suppressed: ${reason}`,
      occurredAt: nowIso,
    });
    return { deliveryId, status: "suppressed" as DeliveryStatus };
  }

  const attemptCount = delivery.attempt_count + 1;
  await updateDeliveryRow(deliveryId, {
    status: "processing",
    attempt_count: attemptCount,
    last_attempt_at: nowIso,
    last_event_type: "processing",
    last_event_at: nowIso,
    last_event_summary: `Processing ${eventLabel(delivery.event_type as DeliveryEventType, delivery.stage_key as DeliveryStageKey | null)}`,
  });
  await updateOutboxRow(deliveryId, {
    status: "processing",
    attempt_count: attemptCount,
    last_attempt_at: nowIso,
    locked_at: nowIso,
    locked_by: worker,
  });

  try {
    const company = await loadCompany(delivery.company_id);
    const emailHtml = renderEmailShell({
      company,
      title: documentTitle,
      body: delivery.message ?? "",
      summaryRows,
      ctaUrl: shareUrl ?? "#",
      ctaLabel:
        delivery.document_type === "customer_statement"
          ? "Open statement"
          : `Open ${delivery.metadata.document_label ?? "document"}`,
    });
    const emailText = `${delivery.message ?? ""}\n\nOpen here: ${shareUrl ?? ""}`;
    const provider = await sendEmail({
      to: delivery.recipient_email_normalized,
      subject: delivery.subject ?? documentTitle,
      html: emailHtml,
      text: emailText,
      senderDisplayName: policy.sender_display_name,
      replyTo: policy.default_reply_to,
    });

    await updateDeliveryRow(deliveryId, {
      status: "sent",
      error: null,
      last_error_kind: null,
      provider_message_id: provider.providerMessageId,
      processed_at: nowIso,
      next_retry_at: null,
      last_event_type: "email.sent",
      last_event_at: nowIso,
      last_event_summary: "Accepted by email provider",
    });
    await updateOutboxRow(deliveryId, {
      status: "sent",
      processed_at: nowIso,
      last_error: null,
      last_error_kind: null,
      locked_at: null,
      locked_by: null,
    });
    await insertDeliveryEvent({
      companyId: delivery.company_id,
      deliveryId,
      providerName: delivery.provider_name ?? "resend",
      providerMessageId: provider.providerMessageId,
      eventType: "email.sent",
      summary: "Accepted by email provider",
      occurredAt: nowIso,
    });
    await insertAuditLog({
      companyId: delivery.company_id,
      actorId: delivery.sent_by,
      recordId: deliveryId,
      action: "send_email",
      documentType: delivery.document_type,
      documentNumber: delivery.document_number ?? deliveryId,
      summary: `Sent ${eventLabel(delivery.event_type as DeliveryEventType, delivery.stage_key as DeliveryStageKey | null)} for ${delivery.document_number ?? deliveryId}`,
      metadata: {
        document_type: delivery.document_type,
        document_id: delivery.document_id,
        recipient: delivery.recipient_email_normalized,
        stage_key: delivery.stage_key,
        send_mode: delivery.send_mode,
        provider_message_id: provider.providerMessageId,
      },
    });
    return {
      deliveryId,
      status: "sent" as DeliveryStatus,
      providerMessageId: provider.providerMessageId,
    };
  } catch (error) {
    const failure = classifySendError(error);
    const exhausted = attemptCount >= policy.max_retry_attempts;
    const nextRetryAt =
      failure.kind === "transient" && !exhausted
        ? computeRetryAt(policy.retry_delay_minutes)
        : null;
    const finalStatus: DeliveryStatus =
      failure.kind === "transient" && !exhausted ? "failed" : "rejected";
    await updateDeliveryRow(deliveryId, {
      status: finalStatus,
      error: failure.message,
      last_error_kind: failure.kind,
      next_retry_at: nextRetryAt,
      rejected_at: finalStatus === "rejected" ? nowIso : null,
      last_event_type: finalStatus === "rejected" ? "email.failed" : "email.retry_scheduled",
      last_event_at: nowIso,
      last_event_summary:
        finalStatus === "rejected"
          ? failure.message
          : `Retry scheduled for ${nextRetryAt?.slice(0, 16).replace("T", " ")}`,
    });
    await updateOutboxRow(deliveryId, {
      status: finalStatus === "rejected" ? "cancelled" : "pending",
      next_attempt_at: nextRetryAt,
      last_error: failure.message,
      last_error_kind: failure.kind,
      processed_at: finalStatus === "rejected" ? nowIso : null,
      locked_at: null,
      locked_by: null,
    });
    await insertDeliveryEvent({
      companyId: delivery.company_id,
      deliveryId,
      providerName: delivery.provider_name ?? "resend",
      providerMessageId: delivery.provider_message_id,
      eventType: finalStatus === "rejected" ? "email.failed" : "email.retry_scheduled",
      summary: failure.message,
      payload: { kind: failure.kind, next_retry_at: nextRetryAt },
      occurredAt: nowIso,
    });
    await insertAuditLog({
      companyId: delivery.company_id,
      actorId: delivery.sent_by,
      recordId: deliveryId,
      action: finalStatus === "rejected" ? "send_failed" : "send_retry",
      documentType: delivery.document_type,
      documentNumber: delivery.document_number ?? deliveryId,
      summary:
        finalStatus === "rejected"
          ? `Delivery failed for ${delivery.document_number ?? deliveryId}`
          : `Retry scheduled for ${delivery.document_number ?? deliveryId}`,
      metadata: {
        document_type: delivery.document_type,
        document_id: delivery.document_id,
        recipient: delivery.recipient_email_normalized,
        error: failure.message,
        next_retry_at: nextRetryAt,
      },
    });
    return { deliveryId, status: finalStatus };
  }
}

export async function sendDocumentDelivery({
  request,
  userId,
  documentType,
  documentId,
  eventType,
  templateKey,
  recipient,
  recipientName,
  subjectOverride,
  messageOverride,
  sendMode = "manual",
  stageKey = null,
  forceNew = false,
}: {
  request: Request;
  userId: string;
  documentType: DeliveryDocumentType;
  documentId: string;
  eventType: DeliveryEventType;
  templateKey?: DeliveryTemplateKey;
  recipient: string;
  recipientName?: string | null;
  subjectOverride?: string | null;
  messageOverride?: string | null;
  sendMode?: DeliverySendMode;
  stageKey?: DeliveryStageKey | null;
  forceNew?: boolean;
}) {
  const queued = await createDeliveryLog({
    request,
    userId,
    documentType,
    documentId,
    eventType,
    stageKey,
    templateKey,
    recipient,
    recipientName,
    subjectOverride,
    messageOverride,
    sendMode,
    forceNew,
  });

  if (queued.status === "rejected" || queued.status === "suppressed") {
    throw new Error(
      queued.status === "rejected"
        ? "Recipient email is missing or invalid."
        : "Recipient is suppressed from finance email delivery.",
    );
  }
  if (!queued.queued) {
    return {
      deliveryId: queued.deliveryId,
      shareUrl: queued.shareUrl,
      status: queued.status,
      duplicate: queued.duplicate,
    };
  }

  const processed = await processQueuedDelivery(queued.deliveryId, "manual");
  if (processed.status === "rejected" || processed.status === "failed" || processed.status === "suppressed") {
    const record = await loadDeliveryById(queued.deliveryId);
    throw new Error(record?.error || "Email send failed");
  }

  return {
    deliveryId: queued.deliveryId,
    shareUrl: queued.shareUrl,
    status: processed.status,
    duplicate: false,
  };
}

export async function processDeliveryOutbox({
  companyId,
  deliveryIds,
  limit = 25,
  worker = "automation",
}: {
  companyId?: string | null;
  deliveryIds?: string[];
  limit?: number;
  worker?: string;
}) {
  const nowIso = new Date().toISOString();
  let query = adminUntyped
    .from("document_delivery_outbox")
    .select("delivery_id")
    .eq("status", "pending")
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (companyId) query = query.eq("company_id", companyId);
  if (deliveryIds && deliveryIds.length > 0) query = query.in("delivery_id", deliveryIds);
  const { data, error } = await query;
  if (error) throw new Error(error.message ?? "Failed to load delivery outbox");

  const results = [];
  for (const row of data ?? []) {
    const deliveryId = String(row.delivery_id);
    results.push(await processQueuedDelivery(deliveryId, worker));
  }
  return {
    processed: results.length,
    sent: results.filter((row) => row.status === "sent").length,
    failed: results.filter((row) => row.status === "failed" || row.status === "rejected").length,
    suppressed: results.filter((row) => row.status === "suppressed").length,
    results,
  };
}

export async function retryFailedDelivery({
  deliveryId,
  actorId,
}: {
  deliveryId: string;
  actorId: string;
}) {
  const delivery = await loadDeliveryById(deliveryId);
  if (!delivery) throw new Error("Delivery not found");
  const nowIso = new Date().toISOString();
  await updateDeliveryRow(deliveryId, {
    status: "pending",
    error: null,
    next_retry_at: nowIso,
    last_event_type: "retry_requested",
    last_event_at: nowIso,
    last_event_summary: "Retry requested manually",
  });
  await updateOutboxRow(deliveryId, {
    status: "pending",
    next_attempt_at: nowIso,
    last_error: null,
    last_error_kind: null,
    processed_at: null,
    locked_at: null,
    locked_by: null,
  });
  await insertDeliveryEvent({
    companyId: delivery.company_id,
    deliveryId,
    providerName: delivery.provider_name ?? "resend",
    providerMessageId: delivery.provider_message_id,
    eventType: "retry_requested",
    summary: "Retry requested manually",
    occurredAt: nowIso,
  });
  await insertAuditLog({
    companyId: delivery.company_id,
    actorId,
    recordId: deliveryId,
    action: "retry_delivery",
    documentType: delivery.document_type,
    documentNumber: delivery.document_number ?? deliveryId,
    summary: `Retry requested for ${delivery.document_number ?? deliveryId}`,
    metadata: {
      document_type: delivery.document_type,
      document_id: delivery.document_id,
      recipient: delivery.recipient_email_normalized,
    },
  });
  return processQueuedDelivery(deliveryId, "manual-retry");
}

export async function sendReminderBatch({
  request,
  actorId,
  companyId,
  stageOverride,
  readyOnly = false,
  search,
}: {
  request: Request;
  actorId: string;
  companyId: string;
  stageOverride?: DeliveryStageKey | null;
  readyOnly?: boolean;
  search?: string | null;
}) {
  const preview = await previewReminderBatch({
    companyId,
    stageOverride,
    readyOnly,
    search,
  });
  const queuedIds: string[] = [];
  for (const item of preview.items.filter((entry) => entry.sendable && (!readyOnly || entry.readyNow))) {
    const queued = await createDeliveryLog({
      request,
      userId: actorId,
      documentType: "invoice",
      documentId: item.documentId,
      eventType: "reminder",
      stageKey: item.targetStage,
      templateKey: item.targetTemplateKey ?? undefined,
      recipient: item.recipient,
      sendMode: "batch",
    });
    if (queued.queued) queuedIds.push(queued.deliveryId);
  }
  const processed =
    queuedIds.length > 0
      ? await processDeliveryOutbox({ companyId, deliveryIds: queuedIds, worker: "batch" })
      : { processed: 0, sent: 0, failed: 0, suppressed: 0 };
  return {
    preview,
    queued: queuedIds.length,
    ...processed,
  };
}

export async function sendStatementBatch({
  request,
  actorId,
  companyId,
  search,
}: {
  request: Request;
  actorId: string;
  companyId: string;
  search?: string | null;
}) {
  const preview = await previewStatementBatch({ companyId, search });
  const queuedIds: string[] = [];
  for (const item of preview.items.filter((entry) => entry.sendable)) {
    const queued = await createDeliveryLog({
      request,
      userId: actorId,
      documentType: "customer_statement",
      documentId: item.documentId,
      eventType: "statement",
      stageKey: "statement",
      templateKey: "customer_statement",
      recipient: item.recipient,
      sendMode: "batch",
    });
    if (queued.queued) queuedIds.push(queued.deliveryId);
  }
  const processed =
    queuedIds.length > 0
      ? await processDeliveryOutbox({ companyId, deliveryIds: queuedIds, worker: "batch" })
      : { processed: 0, sent: 0, failed: 0, suppressed: 0 };
  return {
    preview,
    queued: queuedIds.length,
    ...processed,
  };
}

export async function runScheduledCollections({
  request,
  companyId,
  actorId = null,
  asOf = toIsoDate(new Date()),
}: {
  request: Request;
  companyId: string;
  actorId?: string | null;
  asOf?: string;
}) {
  const policy = await loadCollectionPolicy(companyId);
  const results = {
    reminders: { queued: 0, processed: 0, sent: 0, failed: 0, suppressed: 0 },
    statements: { queued: 0, processed: 0, sent: 0, failed: 0, suppressed: 0 },
  };

  if (policy.auto_reminders_enabled) {
    const reminderRun = await sendReminderBatch({
      request,
      actorId: actorId ?? "00000000-0000-0000-0000-000000000000",
      companyId,
      readyOnly: true,
    });
    results.reminders = {
      queued: reminderRun.queued,
      processed: reminderRun.processed,
      sent: reminderRun.sent,
      failed: reminderRun.failed,
      suppressed: reminderRun.suppressed,
    };
  }

  if (policy.auto_statements_enabled) {
    const today = new Date(`${asOf}T00:00:00`);
    if (today.getDate() === policy.statement_run_day) {
      const statementRun = await sendStatementBatch({
        request,
        actorId: actorId ?? "00000000-0000-0000-0000-000000000000",
        companyId,
      });
      results.statements = {
        queued: statementRun.queued,
        processed: statementRun.processed,
        sent: statementRun.sent,
        failed: statementRun.failed,
        suppressed: statementRun.suppressed,
      };
    }
  }

  return results;
}

export async function getCollectionsDashboard({
  companyId,
  search,
  stage,
}: {
  companyId: string;
  search?: string | null;
  stage?: string | null;
}): Promise<CollectionsDashboardData> {
  const asOf = toIsoDate(new Date());
  const preview = await previewReminderBatch({
    companyId,
    asOf,
    search,
  });
  const filteredItems =
    stage && stage !== "all"
      ? preview.items.filter((item) => (item.targetStage ?? "none") === stage)
      : preview.items;

  const aging = [
    { key: "current" as const, label: "Current / Pre-due" },
    { key: "1-30" as const, label: "1–30 days" },
    { key: "31-60" as const, label: "31–60 days" },
    { key: "61+" as const, label: "61+ days" },
  ].map((bucket) => ({
    ...bucket,
    count: filteredItems.filter((item) => item.agingBucket === bucket.key).length,
    amount: filteredItems
      .filter((item) => item.agingBucket === bucket.key)
      .reduce((sum, item) => sum + item.balanceDue, 0),
  }));

  const { data: failedRows, error } = await adminUntyped
    .from("document_deliveries")
    .select("id, document_number, recipient, status, error, next_retry_at, last_event_summary, source_href")
    .eq("company_id", companyId)
    .in("status", ["failed", "rejected", "bounced", "complained"])
    .order("sent_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message ?? "Failed to load failed delivery diagnostics");

  return {
    asOf,
    totalOverdueAmount: filteredItems
      .filter((item) => item.daysOverdue > 0)
      .reduce((sum, item) => sum + item.balanceDue, 0),
    readyNowCount: filteredItems.filter((item) => item.readyNow).length,
    readyNowAmount: filteredItems
      .filter((item) => item.readyNow)
      .reduce((sum, item) => sum + item.balanceDue, 0),
    failedDeliveries: (failedRows ?? []).length,
    aging,
    items: filteredItems,
    failedQueue: (failedRows ?? []).map((row: Record<string, unknown>) => ({
      deliveryId: String(row.id),
      documentNumber: String(row.document_number ?? "—"),
      recipient: row.recipient ? String(row.recipient) : null,
      status: String(row.status ?? "failed"),
      error: row.error ? String(row.error) : null,
      nextRetryAt: row.next_retry_at ? String(row.next_retry_at) : null,
      lastEventSummary: row.last_event_summary ? String(row.last_event_summary) : null,
      sourceHref: row.source_href ? String(row.source_href) : null,
    })),
  };
}

export async function listDeliveryEvents(deliveryId: string): Promise<DeliveryEventView[]> {
  const { data, error } = await adminUntyped
    .from("document_delivery_events")
    .select("*")
    .eq("delivery_id", deliveryId)
    .order("occurred_at", { ascending: false });
  if (error) throw new Error(error.message ?? "Failed to load delivery events");
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    delivery_id: String(row.delivery_id),
    provider_name: String(row.provider_name ?? "resend"),
    provider_message_id: row.provider_message_id ? String(row.provider_message_id) : null,
    event_type: String(row.event_type ?? ""),
    severity: String(row.severity ?? "info"),
    summary: row.summary ? String(row.summary) : null,
    occurred_at: String(row.occurred_at),
    payload: safeRecord(row.payload),
  }));
}

function verifyResendWebhook(payload: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("RESEND_WEBHOOK_SECRET is not configured.");
  }

  const webhook = new Webhook(secret);
  return webhook.verify(payload, {
    "svix-id": headers.get("svix-id") ?? "",
    "svix-timestamp": headers.get("svix-timestamp") ?? "",
    "svix-signature": headers.get("svix-signature") ?? "",
  }) as Record<string, unknown>;
}

export async function ingestResendWebhook(rawPayload: string, headers: Headers) {
  const verified = verifyResendWebhook(rawPayload, headers);
  const data = safeRecord(verified.data);
  const providerMessageId =
    typeof data.email_id === "string"
      ? data.email_id
      : typeof data.id === "string"
        ? data.id
        : null;
  if (!providerMessageId) throw new Error("Webhook payload did not include an email id.");

  const { data: deliveryRow, error } = await adminUntyped
    .from("document_deliveries")
    .select("*")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "Failed to resolve delivery");
  if (!deliveryRow) return { matched: false };

  const delivery = deliveryRow as Record<string, unknown>;
  const deliveryId = String(delivery.id);
  const companyId = String(delivery.company_id);
  const eventType = String(verified.type ?? "unknown");
  const occurredAt =
    typeof verified.created_at === "string" ? verified.created_at : new Date().toISOString();
  const recipient =
    Array.isArray(data.to) && typeof data.to[0] === "string"
      ? normalizeEmail(data.to[0])
      : normalizeEmail(delivery.recipient as string | null);

  let patch: Record<string, unknown> = {
    last_event_type: eventType,
    last_event_at: occurredAt,
    provider_message_id: providerMessageId,
  };
  let summary = eventType;

  if (eventType === "email.delivered") {
    patch = { ...patch, status: "delivered", delivered_at: occurredAt, last_event_summary: "Delivered to recipient server" };
    summary = "Delivered to recipient server";
  } else if (eventType === "email.bounced") {
    const bounce = safeRecord(data.bounce);
    const reason = typeof bounce.message === "string" ? bounce.message : "Email bounced";
    patch = {
      ...patch,
      status: "bounced",
      bounced_at: occurredAt,
      error: reason,
      last_error_kind: "permanent",
      last_event_summary: reason,
    };
    summary = reason;
    if (recipient) {
      await upsertSuppression({
        companyId,
        email: recipient,
        source: "bounce",
        reason,
      });
    }
  } else if (eventType === "email.complained") {
    const reason = "Recipient marked the email as spam.";
    patch = {
      ...patch,
      status: "complained",
      complained_at: occurredAt,
      error: reason,
      last_error_kind: "permanent",
      last_event_summary: reason,
    };
    summary = reason;
    if (recipient) {
      await upsertSuppression({
        companyId,
        email: recipient,
        source: "complaint",
        reason,
      });
    }
  } else if (eventType === "email.opened") {
    patch = {
      ...patch,
      opened_at: occurredAt,
      last_event_summary: "Opened by recipient",
    };
    summary = "Opened by recipient";
  } else if (eventType === "email.clicked") {
    patch = {
      ...patch,
      clicked_at: occurredAt,
      last_event_summary: "Clicked by recipient",
    };
    summary = "Clicked by recipient";
  } else if (eventType === "email.failed") {
    const reason =
      typeof data.subject === "string"
        ? `Provider failed to send ${data.subject}`
        : "Provider failed to send email";
    patch = {
      ...patch,
      status: "rejected",
      rejected_at: occurredAt,
      error: reason,
      last_error_kind: "permanent",
      last_event_summary: reason,
    };
    summary = reason;
  } else if (eventType === "email.delivery_delayed") {
    patch = {
      ...patch,
      status: "failed",
      last_error_kind: "transient",
      last_event_summary: "Delivery delayed by provider",
    };
    summary = "Delivery delayed by provider";
  } else {
    patch = {
      ...patch,
      last_event_summary: eventType,
    };
  }

  await updateDeliveryRow(deliveryId, patch);
  await insertDeliveryEvent({
    companyId,
    deliveryId,
    providerName: "resend",
    providerMessageId,
    eventType,
    summary,
    payload: safeRecord(verified),
    occurredAt,
  });

  await insertAuditLog({
    companyId,
    actorId: null,
    recordId: deliveryId,
    action: `webhook_${eventType.replace(/\./g, "_")}`,
    documentType: String(delivery.document_type ?? "document"),
    documentNumber: String(delivery.document_number ?? deliveryId),
    summary,
    metadata: {
      provider_message_id: providerMessageId,
      event_type: eventType,
      recipient,
    },
  });

  return { matched: true, deliveryId, eventType };
}
