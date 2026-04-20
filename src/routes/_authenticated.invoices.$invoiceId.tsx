import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, FileText, Printer, Plus, Loader2, Mail, BellRing } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/data/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { RefundsHistory } from "@/components/refunds/RefundsHistory";
import { RecordPaymentDialog } from "@/components/invoices/RecordPaymentDialog";
import { useInvoice } from "@/features/invoices/hooks";
import { usePostingAudit } from "@/features/accounting/ledger";
import { useFinancePermissions } from "@/features/accounting/permissions";
import { useReversePayment, useVoidInvoice } from "@/features/accounting/controls";
import { DocumentCommunicationCard } from "@/components/delivery/DocumentCommunicationCard";
import { SendDocumentDialog } from "@/components/delivery/SendDocumentDialog";
import type { DocumentDelivery } from "@/features/delivery/hooks";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { openDocument } from "@/lib/open-document";
import { PostingAuditCard } from "@/components/accounting/PostingAuditCard";
import { FinanceReasonDialog } from "@/components/accounting/FinanceReasonDialog";

function InvoiceErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <div className="p-6">
      <p className="text-sm text-destructive">Error: {error.message}</p>
      <Button
        size="sm"
        className="mt-2"
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Retry
      </Button>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  component: InvoiceDetailPage,
  errorComponent: InvoiceErrorComponent,
});

interface InvoiceDetailData {
  invoice: {
    id: string;
    invoice_number: string;
    issue_date: string;
    due_date: string | null;
    status: string;
    currency: string;
    subtotal: number;
    tax_total: number;
    total: number;
    amount_paid: number;
    notes: string | null;
    created_at: string;
    cancellation_reason: string | null;
    customers: { id: string; name: string; email: string | null } | null;
  };
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    line_total: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    paid_at: string;
    reference: string | null;
    direction: string;
    status: string;
    cancellation_reason: string | null;
  }>;
}

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const { data, isLoading } = useInvoice(invoiceId);
  const postingAudit = usePostingAudit({
    documentType: "invoice",
    documentIds: data ? [(data as InvoiceDetailData).invoice.id] : [],
  });
  const { company } = useAuth();
  const finance = useFinancePermissions();
  const [payOpen, setPayOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [reversePaymentId, setReversePaymentId] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [deliverySeed, setDeliverySeed] = useState<{
    recipient?: string | null;
    recipientName?: string | null;
    subject?: string | null;
    message?: string | null;
    templateKey?: "invoice_email" | "reminder_friendly" | "reminder_overdue" | "reminder_final";
  } | null>(null);
  const voidInvoice = useVoidInvoice();
  const reversePayment = useReversePayment();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Invoice not found.</p>
        <Button asChild variant="link">
          <Link to="/invoices">Back to invoices</Link>
        </Button>
      </div>
    );
  }

  const { invoice, lines, payments } = data as InvoiceDetailData;
  const currency = invoice.currency || company?.currency || "USD";
  const remaining = Math.max(0, Number(invoice.total) - Number(invoice.amount_paid));
  const fullyPaid = remaining <= 0.0001;
  const isOverdue = invoice.status === "overdue" && remaining > 0.0001;

  function openSend(seed?: DocumentDelivery) {
    setDeliverySeed(
      seed
        ? {
            recipient: seed.recipient,
            recipientName: seed.recipient_name,
            subject: seed.subject,
            message: seed.message,
            templateKey: seed.template_key === "invoice_email" ? "invoice_email" : "invoice_email",
          }
        : null,
    );
    setSendOpen(true);
  }

  function openReminder(seed?: DocumentDelivery) {
    setDeliverySeed(
      seed
        ? {
            recipient: seed.recipient,
            recipientName: seed.recipient_name,
            subject: seed.subject,
            message: seed.message,
            templateKey:
              seed.template_key === "reminder_friendly" ||
              seed.template_key === "reminder_overdue" ||
              seed.template_key === "reminder_final"
                ? seed.template_key
                : "reminder_overdue",
          }
        : null,
    );
    setReminderOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/invoices">
            <ArrowLeft className="mr-1 h-4 w-4" /> Invoices
          </Link>
        </Button>
      </div>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{invoice.invoice_number}</span>
            <StatusBadge status={invoice.status} />
          </span>
        }
        description={`Issued ${formatDate(invoice.issue_date)}${invoice.customers?.name ? ` · ${invoice.customers.name}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void openDocument(`/api/documents/invoice/${invoice.id}`)
              }
            >
              <Printer className="mr-1 h-4 w-4" /> Print / PDF
            </Button>
            {finance.canSendCustomerDocuments && (
              <Button variant="outline" onClick={() => openSend()}>
                <Mail className="mr-1 h-4 w-4" /> Send invoice
              </Button>
            )}
            {finance.canManageCollections && !fullyPaid && (
              <Button variant="outline" onClick={() => openReminder()}>
                <BellRing className="mr-1 h-4 w-4" /> Send reminder
              </Button>
            )}
            {!fullyPaid &&
              invoice.status !== "cancelled" &&
              invoice.customers &&
              finance.canRecordCustomerPayments && (
              <Button onClick={() => setPayOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Record payment
              </Button>
            )}
            {invoice.status !== "cancelled" && finance.canReversePostedDocuments && (
              <Button variant="outline" onClick={() => setVoidOpen(true)}>
                Void invoice
              </Button>
            )}
          </div>
        }
      />

      {isOverdue && (
        <Alert>
          <BellRing className="h-4 w-4" />
          <AlertTitle>Invoice is overdue</AlertTitle>
          <AlertDescription>
            This invoice still has an open balance of {formatMoney(remaining, currency)}
            {invoice.due_date ? ` and was due on ${formatDate(invoice.due_date)}.` : "."}
            {finance.canManageCollections && (
              <span className="block pt-2 text-xs text-muted-foreground">
                Use “Send reminder” to issue a friendly, overdue, or final collections email and
                keep the communication history attached to this invoice.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Description</th>
                      <th className="px-2 py-1.5 text-right">Qty</th>
                      <th className="px-2 py-1.5 text-right">Unit</th>
                      <th className="px-2 py-1.5 text-right">Tax</th>
                      <th className="px-2 py-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="px-2 py-2">{l.description}</td>
                        <td className="px-2 py-2 text-right font-mono">{Number(l.quantity)}</td>
                        <td className="px-2 py-2 text-right font-mono">
                          {formatMoney(l.unit_price, currency)}
                        </td>
                        <td className="px-2 py-2 text-right text-xs text-muted-foreground">
                          {Number(l.tax_rate)}%
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          {formatMoney(l.line_total, currency)}
                        </td>
                      </tr>
                    ))}
                    {lines.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-2 py-6 text-center text-xs text-muted-foreground">
                          No line items.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="border-t bg-muted/30">
                    <tr>
                      <td colSpan={4} className="px-2 py-1.5 text-right text-xs text-muted-foreground">
                        Subtotal
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {formatMoney(invoice.subtotal, currency)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-2 py-1.5 text-right text-xs text-muted-foreground">
                        Tax
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {formatMoney(invoice.tax_total, currency)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-2 py-2 text-right text-xs font-semibold uppercase">
                        Total
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-semibold">
                        {formatMoney(invoice.total, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Payment history</CardTitle>
              <div className="text-right text-xs text-muted-foreground">
                <div>Paid · Remaining</div>
                <div className="text-sm font-semibold text-foreground">
                  {formatMoney(invoice.amount_paid, currency)} ·{" "}
                  <span className={remaining > 0 ? "text-warning-foreground" : "text-success"}>
                    {formatMoney(remaining, currency)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {payments.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">No payments recorded.</p>
              ) : (
                <ul className="divide-y">
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 font-medium capitalize">
                          <span>
                            {p.method.replace("_", " ")}{" "}
                            <span className="text-xs text-muted-foreground">
                              · {formatDate(p.paid_at)}
                            </span>
                          </span>
                          <StatusBadge status={p.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.reference ?? "—"}
                          {p.cancellation_reason ? ` · ${p.cancellation_reason}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-medium ${
                            p.direction === "out" ? "text-destructive" : ""
                          }`}
                        >
                          {p.direction === "out" ? "−" : ""}
                          {formatMoney(p.amount, currency)}
                        </span>
                        {finance.canReversePostedDocuments &&
                          p.status === "completed" &&
                          p.direction === "in" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReversePaymentId(p.id)}
                            >
                              Reverse
                            </Button>
                          )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <PostingAuditCard
            audit={postingAudit.data}
            currency={currency}
            isLoading={postingAudit.isLoading}
            emptyDescription="A posted invoice should produce a clean receivable and revenue journal. If this stays empty, treat it as a finance exception."
          />

          <RefundsHistory source="invoice" sourceId={invoice.id} currency={currency} />

          <DocumentCommunicationCard
            documentType="invoice"
            documentId={invoice.id}
            title="Delivery & reminders"
            actions={
              <div className="flex gap-2">
                {finance.canSendCustomerDocuments && (
                  <Button size="sm" variant="outline" onClick={() => openSend()}>
                    <Mail className="mr-1 h-3.5 w-3.5" /> Send
                  </Button>
                )}
                {finance.canManageCollections && !fullyPaid && (
                  <Button size="sm" variant="outline" onClick={() => openReminder()}>
                    <BellRing className="mr-1 h-3.5 w-3.5" /> Reminder
                  </Button>
                )}
              </div>
            }
            onResend={(delivery) => {
              if (
                delivery.template_key === "reminder_friendly" ||
                delivery.template_key === "reminder_overdue" ||
                delivery.template_key === "reminder_final"
              ) {
                openReminder(delivery);
                return;
              }
              openSend(delivery);
            }}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Number" value={<span className="font-mono">{invoice.invoice_number}</span>} />
              <Row label="Status" value={<StatusBadge status={invoice.status} />} />
              <Row
                label="Customer"
                value={
                  invoice.customers ? (
                    <Link
                      to="/customers/$customerId"
                      params={{ customerId: invoice.customers.id }}
                      className="text-primary hover:underline"
                    >
                      {invoice.customers.name}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <Row label="Issued" value={formatDate(invoice.issue_date)} />
              <Row label="Due" value={formatDate(invoice.due_date)} />
              <Row label="Created" value={formatDateTime(invoice.created_at)} />
              {invoice.cancellation_reason && (
                <Row label="Void reason" value={invoice.cancellation_reason} />
              )}
              <Separator className="my-2" />
              <Row label="Subtotal" value={<MoneyDisplay value={invoice.subtotal} currency={currency} muted />} />
              <Row label="Tax" value={<MoneyDisplay value={invoice.tax_total} currency={currency} muted />} />
              <Row
                label="Total"
                value={<MoneyDisplay value={invoice.total} currency={currency} className="font-semibold" />}
              />
              <Row label="Paid" value={<MoneyDisplay value={invoice.amount_paid} currency={currency} />} />
              <Row
                label="Balance"
                value={
                  <MoneyDisplay
                    value={remaining}
                    currency={currency}
                    className={`font-semibold ${remaining > 0 ? "text-warning-foreground" : "text-success"}`}
                  />
                }
              />
            </CardContent>
          </Card>

          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {invoice.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {invoice.customers && (
        <RecordPaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          invoiceId={invoice.id}
          customerId={invoice.customers.id}
          remaining={remaining}
          currency={currency}
        />
      )}

      <FinanceReasonDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title="Void invoice"
        description="This will cancel the posted invoice without deleting it. Payments must already be reversed."
        confirmLabel="Void invoice"
        pendingLabel="Voiding…"
        actionTone="danger"
        onConfirm={async (reason) => {
          try {
            await voidInvoice.mutateAsync({ invoiceId: invoice.id, reason });
            toast.success("Invoice voided");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to void invoice");
            throw error;
          }
        }}
      />

      <FinanceReasonDialog
        open={!!reversePaymentId}
        onOpenChange={(open) => {
          if (!open) setReversePaymentId(null);
        }}
        title="Reverse payment"
        description="This keeps the original payment in audit history and marks it cancelled through a controlled finance reversal."
        confirmLabel="Reverse payment"
        pendingLabel="Reversing…"
        actionTone="danger"
        onConfirm={async (reason) => {
          if (!reversePaymentId) return;
          try {
            await reversePayment.mutateAsync({ paymentId: reversePaymentId, reason });
            toast.success("Payment reversed");
            setReversePaymentId(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to reverse payment");
            throw error;
          }
        }}
      />

      <SendDocumentDialog
        open={sendOpen}
        onOpenChange={(open) => {
          if (!open) setDeliverySeed(null);
          setSendOpen(open);
        }}
        title="Send invoice"
        description="Send the customer a branded invoice email with a secure document link."
        documentType="invoice"
        documentId={invoice.id}
        eventType="send"
        templateOptions={[{ key: "invoice_email", label: "Invoice email" }]}
        defaultRecipient={invoice.customers?.email}
        defaultRecipientName={invoice.customers?.name}
        variables={{
          company_name: company?.name,
          recipient_name: invoice.customers?.name,
          customer_name: invoice.customers?.name,
          document_label: "invoice",
          document_number: invoice.invoice_number,
          document_date: formatDate(invoice.issue_date),
          due_date: invoice.due_date ? formatDate(invoice.due_date) : null,
          document_total: formatMoney(invoice.total, currency),
          balance_due: formatMoney(remaining, currency),
        }}
        seed={deliverySeed}
      />

      <SendDocumentDialog
        open={reminderOpen}
        onOpenChange={(open) => {
          if (!open) setDeliverySeed(null);
          setReminderOpen(open);
        }}
        title="Send payment reminder"
        description="Choose a reminder preset, adjust the wording if needed, and keep the collections history on this invoice."
        documentType="invoice"
        documentId={invoice.id}
        eventType="reminder"
        templateOptions={[
          {
            key: "reminder_friendly",
            label: "Friendly reminder",
            description: "Use when the balance is recent and you want a softer nudge.",
          },
          {
            key: "reminder_overdue",
            label: "Overdue reminder",
            description: "Use when the due date has passed and payment is expected now.",
          },
          {
            key: "reminder_final",
            label: "Final reminder",
            description: "Use when prior reminders have been ignored and you need firmer wording.",
          },
        ]}
        defaultRecipient={invoice.customers?.email}
        defaultRecipientName={invoice.customers?.name}
        variables={{
          company_name: company?.name,
          recipient_name: invoice.customers?.name,
          customer_name: invoice.customers?.name,
          document_label: "invoice",
          document_number: invoice.invoice_number,
          document_date: formatDate(invoice.issue_date),
          due_date: invoice.due_date ? formatDate(invoice.due_date) : null,
          document_total: formatMoney(invoice.total, currency),
          balance_due: formatMoney(remaining, currency),
        }}
        submitLabel="Send reminder"
        seed={deliverySeed}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
