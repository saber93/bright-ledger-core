import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { usePosOrder } from "@/features/pos/hooks";
import { usePostingAudit } from "@/features/accounting/ledger";
import { useFinancePermissions } from "@/features/accounting/permissions";
import { DocumentCommunicationCard } from "@/components/delivery/DocumentCommunicationCard";
import { SendDocumentDialog } from "@/components/delivery/SendDocumentDialog";
import type { DocumentDelivery } from "@/features/delivery/hooks";
import { useAuth } from "@/lib/auth";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ArrowLeft, FileText, Printer, Mail } from "lucide-react";
import { RefundsHistory } from "@/components/refunds/RefundsHistory";
import { openDocument } from "@/lib/open-document";
import { PostingAuditCard } from "@/components/accounting/PostingAuditCard";
import { useState } from "react";

function PosOrderErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
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

export const Route = createFileRoute("/_authenticated/pos-orders/$orderId")({
  component: PosOrderDetailPage,
  errorComponent: PosOrderErrorComponent,
});

function PosOrderDetailPage() {
  const { orderId } = Route.useParams();
  const { data, isLoading } = usePosOrder(orderId);
  const { company } = useAuth();
  const finance = useFinancePermissions();
  const [sendOpen, setSendOpen] = useState(false);
  const [deliverySeed, setDeliverySeed] = useState<{
    recipient?: string | null;
    recipientName?: string | null;
    subject?: string | null;
    message?: string | null;
    templateKey?: "pos_receipt_email";
  } | null>(null);
  const postingAudit = usePostingAudit({
    sourceHrefs: data?.invoice
      ? [`/pos-orders/${data.order.id}`, `/invoices/${data.invoice.id}`]
      : data
        ? [`/pos-orders/${data.order.id}`]
        : [],
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!data) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Order not found.</p>
        <Button asChild variant="link">
          <Link to="/pos-orders">Back to POS orders</Link>
        </Button>
      </div>
    );
  }
  const { order, lines, pos_payments, invoice, payment_records } = data;
  const currency = order.currency || company?.currency || "USD";

  function openSend(seed?: DocumentDelivery) {
    setDeliverySeed(
      seed
        ? {
            recipient: seed.recipient,
            recipientName: seed.recipient_name,
            subject: seed.subject,
            message: seed.message,
            templateKey: "pos_receipt_email",
          }
        : null,
    );
    setSendOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/pos-orders">
            <ArrowLeft className="mr-1 h-4 w-4" /> POS orders
          </Link>
        </Button>
      </div>

      <PageHeader
        title={order.order_number}
        description={`${order.branches?.name ?? "—"} · ${order.pos_registers?.name ?? "—"}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void openDocument(`/api/documents/pos-receipt/${order.id}`)
              }
            >
              <Printer className="mr-1 h-4 w-4" /> Print receipt
            </Button>
            {finance.canSendPosReceipts && (
              <Button variant="outline" onClick={() => openSend()}>
                <Mail className="mr-1 h-4 w-4" /> Send receipt
              </Button>
            )}
            {invoice && (
              <Button asChild>
                <Link to="/invoices/$invoiceId" params={{ invoiceId: invoice.id }}>
                  <FileText className="mr-1 h-4 w-4" /> View invoice
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {lines.map((l) => (
                <div key={l.id} className="grid grid-cols-12 items-start gap-2 py-2 text-sm">
                  <div className="col-span-6">
                    <div className="font-medium">{l.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {Number(l.quantity)} × {formatMoney(Number(l.unit_price), currency)}
                      {Number(l.discount) > 0 &&
                        ` · −${formatMoney(Number(l.discount), currency)}`}
                      {l.price_override_reason && (
                        <span className="ml-1 text-amber-500">
                          · override: {l.price_override_reason}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 text-right text-xs text-muted-foreground">
                    {Number(l.tax_rate)}% tax · {formatMoney(Number(l.tax_amount), currency)}
                  </div>
                  <div className="col-span-3 text-right font-medium">
                    {formatMoney(Number(l.line_total), currency)}
                  </div>
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="space-y-1 text-sm">
              <Row label="Subtotal" value={formatMoney(Number(order.subtotal), currency)} />
              {Number(order.discount_total) > 0 && (
                <Row
                  label="Discount"
                  value={`−${formatMoney(Number(order.discount_total), currency)}`}
                />
              )}
              <Row label="Tax" value={formatMoney(Number(order.tax_total), currency)} />
              <Row
                label="Total"
                value={formatMoney(Number(order.total), currency)}
                bold
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Status" value={<Badge className="capitalize">{order.status.replace("_", " ")}</Badge>} />
              <Row label="Customer" value={order.customers?.name ?? "Walk-in"} />
              <Row label="Branch" value={order.branches?.name ?? "—"} />
              <Row label="Register" value={order.pos_registers?.name ?? "—"} />
              <Row label="Warehouse" value={order.warehouses?.name ?? "—"} />
              <Row label="Created" value={formatDateTime(order.created_at)} />
              {order.completed_at && (
                <Row label="Completed" value={formatDateTime(order.completed_at)} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {pos_payments.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  No POS payments (on credit)
                </div>
              )}
              {pos_payments.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span className="capitalize text-muted-foreground">{p.method}</span>
                  <span>{formatMoney(Number(p.amount), currency)}</span>
                </div>
              ))}
              {payment_records.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <div className="text-xs uppercase text-muted-foreground">
                    Accounting payments
                  </div>
                  {payment_records.map((p) => (
                    <div key={p.id} className="flex justify-between text-xs">
                      <span className="capitalize">{p.method}</span>
                      <span>{formatMoney(Number(p.amount), currency)}</span>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          <RefundsHistory source="pos" sourceId={order.id} currency={currency} />

          <PostingAuditCard
            audit={postingAudit.data}
            currency={currency}
            isLoading={postingAudit.isLoading}
            emptyDescription="A completed POS order should trace to revenue, settlement, and inventory journals. If this stays empty, treat it as a posting issue."
          />

          <DocumentCommunicationCard
            documentType="pos_receipt"
            documentId={order.id}
            title="Receipt delivery"
            actions={
              finance.canSendPosReceipts ? (
                <Button size="sm" variant="outline" onClick={() => openSend()}>
                  <Mail className="mr-1 h-3.5 w-3.5" /> Send
                </Button>
              ) : undefined
            }
            onResend={(delivery) => openSend(delivery)}
          />

          {invoice && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invoice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Row label="Number" value={invoice.invoice_number} />
                <Row
                  label="Status"
                  value={<Badge className="capitalize">{invoice.status}</Badge>}
                />
                <Row label="Total" value={formatMoney(Number(invoice.total), currency)} />
                <Row
                  label="Paid"
                  value={formatMoney(Number(invoice.amount_paid), currency)}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <SendDocumentDialog
        open={sendOpen}
        onOpenChange={(open) => {
          if (!open) setDeliverySeed(null);
          setSendOpen(open);
        }}
        title="Send POS receipt"
        description="Email the customer a secure receipt link and keep the resend history attached to this order."
        documentType="pos_receipt"
        documentId={order.id}
        eventType="send"
        templateOptions={[{ key: "pos_receipt_email", label: "Receipt email" }]}
        defaultRecipient={order.customers?.email}
        defaultRecipientName={order.customers?.name ?? "Customer"}
        variables={{
          company_name: company?.name,
          recipient_name: order.customers?.name ?? "Customer",
          customer_name: order.customers?.name ?? "Customer",
          document_label: "receipt",
          document_number: order.order_number,
          document_date: formatDateTime(order.completed_at ?? order.created_at),
          document_total: formatMoney(Number(order.total), currency),
        }}
        seed={deliverySeed}
      />
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
