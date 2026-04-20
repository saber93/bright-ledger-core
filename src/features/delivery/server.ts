import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildSharedDocumentUrl,
  createDocumentShareToken,
  fmtDate,
  fmtMoney,
} from "@/routes/-api.documents.shared";
import {
  renderDeliveryTemplate,
  type DeliveryTemplateKey,
  type DeliveryTemplateRecord,
} from "@/features/delivery/templates";

export type DeliveryDocumentType =
  | "invoice"
  | "credit_note"
  | "pos_receipt"
  | "bill"
  | "customer_statement";

export type DeliveryEventType = "send" | "reminder" | "statement";

interface CompanyRecord {
  id: string;
  name: string;
  legal_name: string | null;
  currency: string;
  country: string | null;
}

interface SummaryRow {
  label: string;
  value: string;
}

export interface DeliveryContext {
  documentType: DeliveryDocumentType;
  documentId: string;
  companyId: string;
  company: CompanyRecord;
  documentLabel: string;
  documentNumber: string;
  documentDate: string;
  dueDate: string | null;
  currency: string;
  documentTotal: number;
  balanceDue: number | null;
  recipientName: string | null;
  recipientEmail: string | null;
  printPath: string;
  sourceHref: string;
  summaryRows: SummaryRow[];
}

export interface CustomerStatementData extends DeliveryContext {
  customer: {
    id: string;
    name: string;
    email: string | null;
    currency: string;
  };
  openInvoices: Array<{
    id: string;
    invoice_number: string;
    issue_date: string;
    due_date: string | null;
    total: number;
    amount_paid: number;
    remaining: number;
    currency: string;
    status: string;
  }>;
  recentPayments: Array<{
    id: string;
    paid_at: string;
    amount: number;
    method: string;
    reference: string | null;
  }>;
  recentCredits: Array<{
    id: string;
    credit_note_number: string;
    issue_date: string;
    total: number;
    status: string;
  }>;
  availableCredit: number;
  totalDue: number;
}

type UntypedAdminRelation = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const adminUntyped = supabaseAdmin as unknown as {
  from: (relation: string) => UntypedAdminRelation;
};

function num(value: unknown) {
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function defaultTemplateKeyFor(
  documentType: DeliveryDocumentType,
  eventType: DeliveryEventType,
): DeliveryTemplateKey {
  if (documentType === "invoice" && eventType === "reminder") return "reminder_overdue";
  if (documentType === "customer_statement") return "customer_statement";
  if (documentType === "credit_note") return "credit_note_email";
  if (documentType === "pos_receipt") return "pos_receipt_email";
  if (documentType === "bill") return "bill_email";
  return "invoice_email";
}

function emailActionLabel(eventType: DeliveryEventType, templateKey: DeliveryTemplateKey) {
  if (eventType === "statement") return "statement";
  if (templateKey === "reminder_friendly") return "friendly reminder";
  if (templateKey === "reminder_overdue") return "overdue reminder";
  if (templateKey === "reminder_final") return "final reminder";
  return "email delivery";
}

function lineBreaksToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 14px;">${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  summaryRows: SummaryRow[];
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
                <td style="padding:6px 0; color:#6b7280; font-size:13px;">${escapeHtml(row.label)}</td>
                <td style="padding:6px 0; text-align:right; font-size:13px; color:#111827; font-weight:600;">${escapeHtml(row.value)}</td>
              </tr>`,
            )
            .join("")}
        </table>`;

  return `<!doctype html>
<html lang="en">
  <body style="margin:0; background:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#111827;">
    <div style="max-width:640px; margin:0 auto; padding:28px 16px;">
      <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; overflow:hidden;">
        <div style="padding:24px 28px; border-bottom:1px solid #e5e7eb;">
          <div style="font-size:20px; font-weight:700;">${escapeHtml(company.legal_name || company.name)}</div>
          <div style="margin-top:4px; color:#6b7280; font-size:13px;">${escapeHtml(company.country || "Finance documents")}</div>
        </div>
        <div style="padding:28px;">
          <h1 style="margin:0 0 16px; font-size:20px;">${escapeHtml(title)}</h1>
          ${lineBreaksToHtml(body)}
          ${summaryHtml}
          <div style="margin-top:22px;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:11px 16px; border-radius:8px; font-weight:600;">
              ${escapeHtml(ctaLabel)}
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
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM_ADDRESS?.trim();
  const replyTo = process.env.MAIL_REPLY_TO?.trim();

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
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
      reply_to: replyTo ? [replyTo] : undefined,
    }),
  });

  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.message || `Email provider error (${response.status})`);
  }

  return {
    providerMessageId: payload?.id ?? null,
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

async function loadInvoiceContext(documentId: string): Promise<DeliveryContext | null> {
  const { data: invoice, error } = await supabaseAdmin
    .from("customer_invoices")
    .select("id, company_id, invoice_number, issue_date, due_date, total, amount_paid, currency, customers(name, email)")
    .eq("id", documentId)
    .maybeSingle();
  if (error || !invoice) return null;

  const company = await loadCompany(invoice.company_id);
  const customer = invoice.customers as { name?: string; email?: string | null } | null;
  const balanceDue = Math.max(0, num(invoice.total) - num(invoice.amount_paid));
  const currency = invoice.currency || company.currency || "USD";

  return {
    documentType: "invoice",
    documentId: invoice.id,
    companyId: invoice.company_id,
    company,
    documentLabel: "invoice",
    documentNumber: invoice.invoice_number,
    documentDate: invoice.issue_date,
    dueDate: invoice.due_date ?? null,
    currency,
    documentTotal: num(invoice.total),
    balanceDue,
    recipientName: customer?.name ?? null,
    recipientEmail: customer?.email ?? null,
    printPath: `/api/documents/invoice/${invoice.id}`,
    sourceHref: `/invoices/${invoice.id}`,
    summaryRows: [
      { label: "Invoice", value: invoice.invoice_number },
      { label: "Issued", value: fmtDate(invoice.issue_date) },
      { label: "Total", value: fmtMoney(invoice.total, currency) },
      { label: "Balance due", value: fmtMoney(balanceDue, currency) },
    ],
  };
}

async function loadCreditNoteContext(documentId: string): Promise<DeliveryContext | null> {
  const { data: note, error } = await supabaseAdmin
    .from("credit_notes")
    .select("id, company_id, credit_note_number, issue_date, total, currency, customers(name, email)")
    .eq("id", documentId)
    .maybeSingle();
  if (error || !note) return null;

  const company = await loadCompany(note.company_id);
  const customer = note.customers as { name?: string; email?: string | null } | null;
  const currency = note.currency || company.currency || "USD";

  return {
    documentType: "credit_note",
    documentId: note.id,
    companyId: note.company_id,
    company,
    documentLabel: "credit note",
    documentNumber: note.credit_note_number,
    documentDate: note.issue_date,
    dueDate: null,
    currency,
    documentTotal: num(note.total),
    balanceDue: null,
    recipientName: customer?.name ?? null,
    recipientEmail: customer?.email ?? null,
    printPath: `/api/documents/credit-note/${note.id}`,
    sourceHref: `/refunds/${note.id}`,
    summaryRows: [
      { label: "Credit note", value: note.credit_note_number },
      { label: "Issued", value: fmtDate(note.issue_date) },
      { label: "Total", value: fmtMoney(note.total, currency) },
    ],
  };
}

async function loadPosReceiptContext(documentId: string): Promise<DeliveryContext | null> {
  const { data: order, error } = await supabaseAdmin
    .from("pos_orders")
    .select("id, company_id, order_number, created_at, total, currency, customers(name, email)")
    .eq("id", documentId)
    .maybeSingle();
  if (error || !order) return null;

  const company = await loadCompany(order.company_id);
  const customer = order.customers as { name?: string; email?: string | null } | null;
  const currency = order.currency || company.currency || "USD";

  return {
    documentType: "pos_receipt",
    documentId: order.id,
    companyId: order.company_id,
    company,
    documentLabel: "receipt",
    documentNumber: order.order_number,
    documentDate: order.created_at,
    dueDate: null,
    currency,
    documentTotal: num(order.total),
    balanceDue: null,
    recipientName: customer?.name ?? "Customer",
    recipientEmail: customer?.email ?? null,
    printPath: `/api/documents/pos-receipt/${order.id}`,
    sourceHref: `/pos-orders/${order.id}`,
    summaryRows: [
      { label: "Receipt", value: order.order_number },
      { label: "Date", value: fmtDate(order.created_at) },
      { label: "Total", value: fmtMoney(order.total, currency) },
    ],
  };
}

async function loadBillContext(documentId: string): Promise<DeliveryContext | null> {
  const { data: bill, error } = await supabaseAdmin
    .from("supplier_bills")
    .select("id, company_id, bill_number, issue_date, due_date, total, amount_paid, currency, suppliers(name, email)")
    .eq("id", documentId)
    .maybeSingle();
  if (error || !bill) return null;

  const company = await loadCompany(bill.company_id);
  const supplier = bill.suppliers as { name?: string; email?: string | null } | null;
  const balanceDue = Math.max(0, num(bill.total) - num(bill.amount_paid));
  const currency = bill.currency || company.currency || "USD";

  return {
    documentType: "bill",
    documentId: bill.id,
    companyId: bill.company_id,
    company,
    documentLabel: "bill",
    documentNumber: bill.bill_number,
    documentDate: bill.issue_date,
    dueDate: bill.due_date ?? null,
    currency,
    documentTotal: num(bill.total),
    balanceDue,
    recipientName: supplier?.name ?? null,
    recipientEmail: supplier?.email ?? null,
    printPath: `/api/documents/bill/${bill.id}`,
    sourceHref: `/bills/${bill.id}`,
    summaryRows: [
      { label: "Bill", value: bill.bill_number },
      { label: "Issued", value: fmtDate(bill.issue_date) },
      { label: "Total", value: fmtMoney(bill.total, currency) },
      { label: "Balance", value: fmtMoney(balanceDue, currency) },
    ],
  };
}

export async function loadCustomerStatementDocument(customerId: string): Promise<CustomerStatementData | null> {
  const { data: customer, error } = await supabaseAdmin
    .from("customers")
    .select("id, company_id, name, email, currency")
    .eq("id", customerId)
    .maybeSingle();
  if (error || !customer) return null;

  const company = await loadCompany(customer.company_id);
  const currency = customer.currency || company.currency || "USD";

  const [invoicesRes, paymentsRes, creditsRes, creditBalanceRes] = await Promise.all([
    supabaseAdmin
      .from("customer_invoices")
      .select("id, invoice_number, issue_date, due_date, total, amount_paid, currency, status")
      .eq("customer_id", customerId)
      .neq("status", "draft")
      .neq("status", "cancelled")
      .order("issue_date", { ascending: false }),
    supabaseAdmin
      .from("payments")
      .select("id, paid_at, amount, method, reference, status")
      .eq("customer_id", customerId)
      .eq("direction", "in")
      .eq("status", "completed")
      .order("paid_at", { ascending: false })
      .limit(12),
    supabaseAdmin
      .from("credit_notes")
      .select("id, credit_note_number, issue_date, total, status")
      .eq("customer_id", customerId)
      .neq("status", "void")
      .order("issue_date", { ascending: false })
      .limit(12),
    adminUntyped
      .from("customer_credit_balance")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle(),
  ]);

  if (invoicesRes.error) throw invoicesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (creditsRes.error) throw creditsRes.error;
  if (creditBalanceRes.error) throw new Error(creditBalanceRes.error.message ?? "Failed to load customer credit balance");

  const openInvoices = (invoicesRes.data ?? [])
    .map((invoice) => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date ?? null,
      total: num(invoice.total),
      amount_paid: num(invoice.amount_paid),
      remaining: Math.max(0, num(invoice.total) - num(invoice.amount_paid)),
      currency: invoice.currency || currency,
      status: invoice.status,
    }))
    .filter((invoice) => invoice.remaining > 0.005);

  const recentPayments = (paymentsRes.data ?? []).map((payment) => ({
    id: payment.id,
    paid_at: payment.paid_at,
    amount: num(payment.amount),
    method: String(payment.method ?? "other"),
    reference: payment.reference ?? null,
  }));

  const recentCredits = (creditsRes.data ?? []).map((note) => ({
    id: note.id,
    credit_note_number: note.credit_note_number,
    issue_date: note.issue_date,
    total: num(note.total),
    status: String(note.status ?? ""),
  }));

  const availableCredit = num((creditBalanceRes.data as Record<string, unknown> | null)?.balance ?? 0);
  const totalDue = openInvoices.reduce((sum, invoice) => sum + invoice.remaining, 0);
  const todayIso = new Date().toISOString().slice(0, 10);

  return {
    documentType: "customer_statement",
    documentId: customer.id,
    companyId: customer.company_id,
    company,
    documentLabel: "statement",
    documentNumber: `STATEMENT-${todayIso}`,
    documentDate: todayIso,
    dueDate: null,
    currency,
    documentTotal: totalDue,
    balanceDue: totalDue,
    recipientName: customer.name,
    recipientEmail: customer.email ?? null,
    printPath: `/api/documents/customer-statement/${customer.id}`,
    sourceHref: `/customers/${customer.id}`,
    summaryRows: [
      { label: "Customer", value: customer.name },
      { label: "Open invoices", value: String(openInvoices.length) },
      { label: "Total due", value: fmtMoney(totalDue, currency) },
      { label: "Available credit", value: fmtMoney(availableCredit, currency) },
    ],
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email ?? null,
      currency,
    },
    openInvoices,
    recentPayments,
    recentCredits,
    availableCredit,
    totalDue,
  };
}

export async function loadDeliveryContext(
  documentType: DeliveryDocumentType,
  documentId: string,
): Promise<DeliveryContext | CustomerStatementData | null> {
  switch (documentType) {
    case "invoice":
      return loadInvoiceContext(documentId);
    case "credit_note":
      return loadCreditNoteContext(documentId);
    case "pos_receipt":
      return loadPosReceiptContext(documentId);
    case "bill":
      return loadBillContext(documentId);
    case "customer_statement":
      return loadCustomerStatementDocument(documentId);
    default:
      return null;
  }
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
  documentType,
  documentNumber,
  summary,
  metadata,
}: {
  companyId: string;
  actorId: string;
  recordId: string;
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
    action: "send_email",
    entity_type: documentType,
    entity_number: documentNumber,
    summary,
    metadata,
    after: metadata,
  });
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
}) {
  const context = await loadDeliveryContext(documentType, documentId);
  if (!context) {
    throw new Error("Document not found.");
  }

  const resolvedTemplateKey = templateKey ?? defaultTemplateKeyFor(documentType, eventType);
  const overrides = await loadTemplateOverrides(context.companyId);
  const shareToken = await createDocumentShareToken({
    companyId: context.companyId,
    documentType,
    documentId,
    createdBy: userId,
    expiresInDays: documentType === "customer_statement" ? 7 : 14,
  });
  const shareUrl = buildSharedDocumentUrl(request, context.printPath, shareToken.token);

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
      document_url: shareUrl,
    },
    overrides,
  );

  const subject = subjectOverride?.trim() || rendered.subject;
  const message = messageOverride?.trim() || rendered.body;

  const { data: delivery, error: insertError } = await adminUntyped
    .from("document_deliveries")
    .insert({
      company_id: context.companyId,
      document_type: documentType,
      document_id: documentId,
      document_number: context.documentNumber,
      channel: "email",
      event_type: eventType,
      template_key: resolvedTemplateKey,
      recipient,
      recipient_name: recipientName ?? context.recipientName ?? null,
      subject,
      message,
      status: "pending",
      sent_by: userId,
      sent_at: new Date().toISOString(),
      share_token_id: shareToken.id,
      source_href: context.sourceHref,
      metadata: {
        share_expires_at: shareToken.expiresAt,
        summary_rows: context.summaryRows,
      },
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message ?? "Failed to create delivery log");

  const deliveryId = String(delivery.id);

  try {
    const emailHtml = renderEmailShell({
      company: context.company,
      title: `${context.documentLabel[0].toUpperCase()}${context.documentLabel.slice(1)} ${context.documentNumber}`,
      body: message,
      summaryRows: context.summaryRows,
      ctaUrl: shareUrl,
      ctaLabel:
        documentType === "customer_statement" ? "Open statement" : `Open ${context.documentLabel}`,
    });
    const emailText = `${message}\n\nOpen here: ${shareUrl}`;
    const provider = await sendEmail({
      to: recipient,
      subject,
      html: emailHtml,
      text: emailText,
    });

    await adminUntyped
      .from("document_deliveries")
      .update({
        status: "sent",
        error: null,
        provider_message_id: provider.providerMessageId,
      })
      .eq("id", deliveryId);

    await insertAuditLog({
      companyId: context.companyId,
      actorId: userId,
      recordId: deliveryId,
      documentType,
      documentNumber: context.documentNumber,
      summary: `Sent ${emailActionLabel(eventType, resolvedTemplateKey)} for ${context.documentNumber}`,
      metadata: {
        document_type: documentType,
        document_id: documentId,
        recipient,
        event_type: eventType,
        template_key: resolvedTemplateKey,
        share_expires_at: shareToken.expiresAt,
      },
    });

    return {
      deliveryId,
      shareUrl,
      status: "sent",
    };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Email send failed";

    await adminUntyped
      .from("document_deliveries")
      .update({
        status: "failed",
        error: messageText,
      })
      .eq("id", deliveryId);

    await insertAuditLog({
      companyId: context.companyId,
      actorId: userId,
      recordId: deliveryId,
      documentType,
      documentNumber: context.documentNumber,
      summary: `Failed ${emailActionLabel(eventType, resolvedTemplateKey)} for ${context.documentNumber}`,
      metadata: {
        document_type: documentType,
        document_id: documentId,
        recipient,
        event_type: eventType,
        template_key: resolvedTemplateKey,
        error: messageText,
      },
    });

    throw new Error(messageText);
  }
}
