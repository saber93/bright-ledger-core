import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Undo2, Loader2, FileText, Receipt, Printer } from "lucide-react";
import { PageHeader } from "@/components/data/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { useCreditNote } from "@/features/refunds/hooks";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/refunds/$creditNoteId")({
  component: RefundDetailPage,
});

function RefundDetailPage() {
  const { creditNoteId } = Route.useParams();
  const { data, isLoading } = useCreditNote(creditNoteId);
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";

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
        <p className="text-sm text-muted-foreground">Credit note not found.</p>
        <Button asChild variant="link">
          <Link to="/refunds">Back to refunds</Link>
        </Button>
      </div>
    );
  }

  const { note, lines, allocations, cash_refunds } = data as {
    note: {
      id: string;
      credit_note_number: string;
      issue_date: string;
      created_at: string;
      status: string;
      source_type: string;
      reason: string | null;
      notes: string | null;
      restock: boolean;
      subtotal: number;
      tax_total: number;
      total: number;
      amount_allocated: number;
      currency: string;
      customers: { id: string; name: string; email: string | null } | null;
      customer_invoices: { id: string; invoice_number: string } | null;
      pos_orders: { id: string; order_number: string } | null;
    };
    lines: Array<{
      id: string;
      description: string;
      quantity: number;
      unit_price: number;
      tax_rate: number;
      tax_amount: number;
      line_total: number;
      product_id: string | null;
    }>;
    allocations: Array<{
      id: string;
      target_type: "invoice" | "customer_credit" | "cash_refund";
      amount: number;
      note: string | null;
      customer_invoices: { invoice_number: string } | null;
    }>;
    cash_refunds: Array<{
      id: string;
      amount: number;
      method: string;
      paid_at: string;
      reference: string | null;
    }>;
  };

  const cur = note.currency || currency;

  const allocByType = {
    invoice: allocations
      .filter((a) => a.target_type === "invoice")
      .reduce((s, a) => s + Number(a.amount), 0),
    customer_credit: allocations
      .filter((a) => a.target_type === "customer_credit")
      .reduce((s, a) => s + Number(a.amount), 0),
    cash_refund: allocations
      .filter((a) => a.target_type === "cash_refund")
      .reduce((s, a) => s + Number(a.amount), 0),
  };

  const restockedGoods = lines.filter((l) => l.product_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/refunds">
            <ArrowLeft className="mr-1 h-4 w-4" /> Refunds
          </Link>
        </Button>
      </div>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{note.credit_note_number}</span>
            <StatusBadge status={note.status} />
          </span>
        }
        description={`Issued ${formatDate(note.issue_date)}${note.customers?.name ? ` · ${note.customers.name}` : ""}`}
        actions={
          <Button
            variant="outline"
            onClick={() => void openDocument(`/api/documents/credit-note/${note.id}`)}
          >
            <Printer className="mr-1 h-4 w-4" /> Print / PDF
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Refunded lines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Item</th>
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
                          {formatMoney(l.unit_price, cur)}
                        </td>
                        <td className="px-2 py-2 text-right text-xs text-muted-foreground">
                          {Number(l.tax_rate)}% · {formatMoney(l.tax_amount, cur)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          {formatMoney(l.line_total, cur)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/30">
                    <tr>
                      <td colSpan={4} className="px-2 py-1.5 text-right text-xs text-muted-foreground">
                        Subtotal
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {formatMoney(note.subtotal, cur)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-2 py-1.5 text-right text-xs text-muted-foreground">
                        Tax
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {formatMoney(note.tax_total, cur)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-2 py-2 text-right text-xs font-semibold uppercase">
                        Total
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-semibold">
                        {formatMoney(note.total, cur)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Allocation breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-3">
                <Stat
                  label="Invoice reduction"
                  value={<MoneyDisplay value={allocByType.invoice} currency={cur} />}
                />
                <Stat
                  label="Customer credit"
                  value={<MoneyDisplay value={allocByType.customer_credit} currency={cur} />}
                />
                <Stat
                  label="Cash refund"
                  value={<MoneyDisplay value={allocByType.cash_refund} currency={cur} />}
                />
              </div>
              <Separator className="my-3" />
              {allocations.length === 0 ? (
                <p className="text-xs text-muted-foreground">No allocations recorded.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {allocations.map((a) => (
                    <li key={a.id} className="flex justify-between border-b border-border/40 py-1.5 last:border-b-0">
                      <span>
                        <span className="capitalize">{a.target_type.replace("_", " ")}</span>
                        {a.target_type === "invoice" && a.customer_invoices?.invoice_number && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            → {a.customer_invoices.invoice_number}
                          </span>
                        )}
                        {a.note && (
                          <span className="ml-2 text-xs text-muted-foreground">· {a.note}</span>
                        )}
                      </span>
                      <span className="font-mono">{formatMoney(a.amount, cur)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {cash_refunds.length > 0 && (
                <>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Cash impact
                  </div>
                  <ul className="mt-1 space-y-1 text-sm">
                    {cash_refunds.map((c) => (
                      <li key={c.id} className="flex justify-between text-xs">
                        <span>
                          <span className="capitalize">{c.method}</span>{" "}
                          <span className="text-muted-foreground">
                            · {formatDateTime(c.paid_at)}
                            {c.reference ? ` · ${c.reference}` : ""}
                          </span>
                        </span>
                        <span className="font-mono text-destructive">
                          −{formatMoney(c.amount, cur)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          {note.restock && restockedGoods.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stock impact</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {restockedGoods.map((l) => (
                    <li key={l.id} className="flex justify-between text-sm">
                      <span>{l.description}</span>
                      <span className="font-mono text-success">+{Number(l.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Type" value={<Badge className="capitalize">{note.source_type}</Badge>} />
              {note.customer_invoices && (
                <Row
                  label="Invoice"
                  value={
                    <Link to="/invoices" className="font-mono text-primary hover:underline">
                      {note.customer_invoices.invoice_number}
                    </Link>
                  }
                />
              )}
              {note.pos_orders && (
                <Row
                  label="POS order"
                  value={
                    <Link
                      to="/pos-orders/$orderId"
                      params={{ orderId: note.pos_orders.id }}
                      className="font-mono text-primary hover:underline"
                    >
                      {note.pos_orders.order_number}
                    </Link>
                  }
                />
              )}
              {note.customers && (
                <Row
                  label="Customer"
                  value={
                    <Link
                      to="/customers/$customerId"
                      params={{ customerId: note.customers.id }}
                      className="text-primary hover:underline"
                    >
                      {note.customers.name}
                    </Link>
                  }
                />
              )}
              <Row label="Issued" value={formatDate(note.issue_date)} />
              <Row label="Created" value={formatDateTime(note.created_at)} />
              {note.reason && <Row label="Reason" value={note.reason} />}
              <Row label="Restock" value={note.restock ? "Yes" : "No"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Refund total" value={<MoneyDisplay value={note.total} currency={cur} />} />
              <Row
                label="Allocated"
                value={<MoneyDisplay value={note.amount_allocated} currency={cur} />}
              />
            </CardContent>
          </Card>

          {note.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{note.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
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

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
