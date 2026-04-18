import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, FileText, Printer, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/data/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { RefundsHistory } from "@/components/refunds/RefundsHistory";
import { RecordPaymentDialog } from "@/components/invoices/RecordPaymentDialog";
import { useInvoice } from "@/features/invoices/hooks";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { openDocument } from "@/lib/open-document";

export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  component: InvoiceDetailPage,
  errorComponent: ({ error, reset }) => {
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
  },
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
  }>;
}

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const { data, isLoading } = useInvoice(invoiceId);
  const { company } = useAuth();
  const [payOpen, setPayOpen] = useState(false);

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
            {!fullyPaid && invoice.status !== "cancelled" && invoice.customers && (
              <Button onClick={() => setPayOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Record payment
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
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium capitalize">
                          {p.method.replace("_", " ")}{" "}
                          <span className="text-xs text-muted-foreground">
                            · {formatDate(p.paid_at)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.reference ?? "—"}
                        </div>
                      </div>
                      <span
                        className={`font-mono font-medium ${
                          p.direction === "out" ? "text-destructive" : ""
                        }`}
                      >
                        {p.direction === "out" ? "−" : ""}
                        {formatMoney(p.amount, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <RefundsHistory source="invoice" sourceId={invoice.id} currency={currency} />
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
