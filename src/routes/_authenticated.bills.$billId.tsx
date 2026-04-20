import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, FileText, Loader2, Plus, Printer, Mail } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/data/PageHeader";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RecordBillPaymentDialog } from "@/components/bills/RecordBillPaymentDialog";
import { useBill } from "@/features/bills/hooks";
import { usePostingAudit } from "@/features/accounting/ledger";
import { useFinancePermissions } from "@/features/accounting/permissions";
import { useReversePayment, useVoidBill } from "@/features/accounting/controls";
import { DocumentCommunicationCard } from "@/components/delivery/DocumentCommunicationCard";
import { SendDocumentDialog } from "@/components/delivery/SendDocumentDialog";
import type { DocumentDelivery } from "@/features/delivery/hooks";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { openDocument } from "@/lib/open-document";
import { PostingAuditCard } from "@/components/accounting/PostingAuditCard";
import { FinanceReasonDialog } from "@/components/accounting/FinanceReasonDialog";

function BillErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
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

export const Route = createFileRoute("/_authenticated/bills/$billId")({
  component: BillDetailPage,
  errorComponent: BillErrorComponent,
});

interface BillDetailData {
  bill: {
    id: string;
    bill_number: string;
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
    suppliers: { id: string; name: string; email: string | null } | null;
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

function BillDetailPage() {
  const { billId } = Route.useParams();
  const { data, isLoading } = useBill(billId);
  const postingAudit = usePostingAudit({
    documentType: "bill",
    documentIds: data ? [(data as BillDetailData).bill.id] : [],
  });
  const { company } = useAuth();
  const finance = useFinancePermissions();
  const [payOpen, setPayOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [reversePaymentId, setReversePaymentId] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [deliverySeed, setDeliverySeed] = useState<{
    recipient?: string | null;
    recipientName?: string | null;
    subject?: string | null;
    message?: string | null;
    templateKey?: "bill_email";
  } | null>(null);
  const voidBill = useVoidBill();
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
        <p className="text-sm text-muted-foreground">Bill not found.</p>
        <Button asChild variant="link">
          <Link to="/bills">Back to bills</Link>
        </Button>
      </div>
    );
  }

  const { bill, lines, payments } = data as BillDetailData;
  const currency = bill.currency || company?.currency || "USD";
  const remaining = Math.max(0, Number(bill.total) - Number(bill.amount_paid));
  const fullyPaid = remaining <= 0.0001;

  function openSend(seed?: DocumentDelivery) {
    setDeliverySeed(
      seed
        ? {
            recipient: seed.recipient,
            recipientName: seed.recipient_name,
            subject: seed.subject,
            message: seed.message,
            templateKey: "bill_email",
          }
        : null,
    );
    setSendOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/bills">
            <ArrowLeft className="mr-1 h-4 w-4" /> Bills
          </Link>
        </Button>
      </div>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{bill.bill_number}</span>
            <StatusBadge status={bill.status} />
          </span>
        }
        description={`Issued ${formatDate(bill.issue_date)}${bill.suppliers?.name ? ` · ${bill.suppliers.name}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void openDocument(`/api/documents/bill/${bill.id}`)}
            >
              <Printer className="mr-1 h-4 w-4" /> Print / PDF
            </Button>
            {finance.canSendSupplierDocuments && (
              <Button variant="outline" onClick={() => openSend()}>
                <Mail className="mr-1 h-4 w-4" /> Send bill
              </Button>
            )}
            {!fullyPaid &&
              bill.status !== "cancelled" &&
              bill.suppliers &&
              finance.canRecordSupplierPayments && (
              <Button onClick={() => setPayOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Record payment
              </Button>
            )}
            {bill.status !== "cancelled" && finance.canReversePostedDocuments && (
              <Button variant="outline" onClick={() => setVoidOpen(true)}>
                Void bill
              </Button>
            )}
          </div>
        }
      />

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
                    {lines.map((line) => (
                      <tr key={line.id} className="border-t">
                        <td className="px-2 py-2">{line.description}</td>
                        <td className="px-2 py-2 text-right font-mono">{Number(line.quantity)}</td>
                        <td className="px-2 py-2 text-right font-mono">
                          {formatMoney(line.unit_price, currency)}
                        </td>
                        <td className="px-2 py-2 text-right text-xs text-muted-foreground">
                          {Number(line.tax_rate)}%
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          {formatMoney(line.line_total, currency)}
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
                        {formatMoney(bill.subtotal, currency)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-2 py-1.5 text-right text-xs text-muted-foreground">
                        Tax
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {formatMoney(bill.tax_total, currency)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-2 py-2 text-right text-xs font-semibold uppercase">
                        Total
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-semibold">
                        {formatMoney(bill.total, currency)}
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
                  {formatMoney(bill.amount_paid, currency)} ·{" "}
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
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 font-medium capitalize">
                          <span>
                            {payment.method.replace("_", " ")}{" "}
                            <span className="text-xs text-muted-foreground">
                              · {formatDate(payment.paid_at)}
                            </span>
                          </span>
                          <StatusBadge status={payment.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {payment.reference ?? "—"}
                          {payment.cancellation_reason ? ` · ${payment.cancellation_reason}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-destructive">
                          −{formatMoney(payment.amount, currency)}
                        </span>
                        {finance.canReversePostedDocuments && payment.status === "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReversePaymentId(payment.id)}
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
            emptyDescription="A posted bill should create a payable and expense journal. If this stays empty, treat it as a finance exception."
          />

          <DocumentCommunicationCard
            documentType="bill"
            documentId={bill.id}
            title="Delivery history"
            actions={
              finance.canSendSupplierDocuments ? (
                <Button size="sm" variant="outline" onClick={() => openSend()}>
                  <Mail className="mr-1 h-3.5 w-3.5" /> Send
                </Button>
              ) : undefined
            }
            onResend={(delivery) => openSend(delivery)}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Number" value={<span className="font-mono">{bill.bill_number}</span>} />
              <Row label="Status" value={<StatusBadge status={bill.status} />} />
              <Row label="Supplier" value={bill.suppliers?.name ?? "—"} />
              <Row label="Issued" value={formatDate(bill.issue_date)} />
              <Row label="Due" value={formatDate(bill.due_date)} />
              <Row label="Created" value={formatDateTime(bill.created_at)} />
              {bill.cancellation_reason && <Row label="Void reason" value={bill.cancellation_reason} />}
              <Separator className="my-2" />
              <Row label="Subtotal" value={<MoneyDisplay value={bill.subtotal} currency={currency} muted />} />
              <Row label="Tax" value={<MoneyDisplay value={bill.tax_total} currency={currency} muted />} />
              <Row
                label="Total"
                value={<MoneyDisplay value={bill.total} currency={currency} className="font-semibold" />}
              />
              <Row label="Paid" value={<MoneyDisplay value={bill.amount_paid} currency={currency} />} />
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

          {bill.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{bill.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {bill.suppliers && (
        <RecordBillPaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          billId={bill.id}
          supplierId={bill.suppliers.id}
          remaining={remaining}
          currency={currency}
        />
      )}

      <FinanceReasonDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title="Void bill"
        description="This will cancel the posted bill without deleting it. Supplier payments must already be reversed."
        confirmLabel="Void bill"
        pendingLabel="Voiding…"
        actionTone="danger"
        onConfirm={async (reason) => {
          try {
            await voidBill.mutateAsync({ billId: bill.id, reason });
            toast.success("Bill voided");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to void bill");
            throw error;
          }
        }}
      />

      <FinanceReasonDialog
        open={!!reversePaymentId}
        onOpenChange={(open) => {
          if (!open) setReversePaymentId(null);
        }}
        title="Reverse supplier payment"
        description="This marks the payment cancelled through a controlled finance reversal and updates the bill balance safely."
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
        title="Send supplier bill"
        description="Email the bill to the supplier using the current printable document and keep a delivery history."
        documentType="bill"
        documentId={bill.id}
        eventType="send"
        templateOptions={[{ key: "bill_email", label: "Supplier bill email" }]}
        defaultRecipient={bill.suppliers?.email}
        defaultRecipientName={bill.suppliers?.name}
        variables={{
          company_name: company?.name,
          recipient_name: bill.suppliers?.name,
          supplier_name: bill.suppliers?.name,
          document_label: "bill",
          document_number: bill.bill_number,
          document_date: formatDate(bill.issue_date),
          due_date: bill.due_date ? formatDate(bill.due_date) : null,
          document_total: formatMoney(bill.total, currency),
          balance_due: formatMoney(remaining, currency),
        }}
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
