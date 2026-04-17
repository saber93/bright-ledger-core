import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ClipboardList, FileText, CheckCircle2, Truck, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { DataTable } from "@/components/data/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
  useSalesOrder,
  useUpdateSalesOrderStatus,
  useConvertSalesOrderToInvoice,
  type SalesOrderStatus,
} from "@/features/sales-orders/hooks";

export const Route = createFileRoute("/_authenticated/sales/$orderId")({
  component: SalesOrderDetailPage,
});

const STATUS_FLOW: Record<SalesOrderStatus, { next?: SalesOrderStatus; label?: string; icon?: typeof CheckCircle2 }> = {
  draft: { next: "quotation", label: "Send quotation", icon: FileText },
  quotation: { next: "confirmed", label: "Confirm order", icon: CheckCircle2 },
  confirmed: { next: "fulfilled", label: "Mark fulfilled", icon: Truck },
  fulfilled: {},
  invoiced: {},
  cancelled: {},
};

function SalesOrderDetailPage() {
  const { orderId } = Route.useParams();
  const { data, isLoading } = useSalesOrder(orderId);
  const updateStatus = useUpdateSalesOrderStatus();
  const convert = useConvertSalesOrderToInvoice();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Loading…" />
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading order…
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Order not found" />
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="Order not found"
          description="It may have been deleted or you don't have access."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/sales">
                <ArrowLeft className="h-4 w-4" />
                Back to sales
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { order, lines } = data;
  const customer = (order as unknown as { customers: { id: string; name: string; email: string | null; phone: string | null; address_line1: string | null; city: string | null; country: string | null } }).customers;

  const flow = STATUS_FLOW[order.status as SalesOrderStatus];
  const NextIcon = flow.icon;
  const canCancel = !["invoiced", "cancelled", "fulfilled"].includes(order.status);
  const canConvert = ["confirmed", "fulfilled"].includes(order.status);

  const handleAdvance = async () => {
    if (!flow.next) return;
    try {
      await updateStatus.mutateAsync({ id: order.id, status: flow.next });
      toast.success(`Order moved to ${flow.next}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  const handleCancel = async () => {
    try {
      await updateStatus.mutateAsync({ id: order.id, status: "cancelled" });
      toast.success("Order cancelled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel");
    }
  };

  const handleConvert = async () => {
    try {
      const { invoiceId } = await convert.mutateAsync(order.id);
      toast.success("Invoice created from order");
      navigate({ to: "/invoices", search: { highlight: invoiceId } as never }).catch(() => {
        navigate({ to: "/invoices" });
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to convert");
    }
  };

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{order.order_number}</span>
            <StatusBadge status={order.status} />
          </span>
        }
        description={
          <span className="text-xs text-muted-foreground">
            {customer?.name} · Ordered {formatDate(order.order_date)}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/sales">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            {flow.next && (
              <Button size="sm" onClick={handleAdvance} disabled={updateStatus.isPending}>
                {updateStatus.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : NextIcon ? (
                  <NextIcon className="h-4 w-4" />
                ) : null}
                {flow.label}
              </Button>
            )}
            {canConvert && (
              <Button
                size="sm"
                variant="default"
                onClick={handleConvert}
                disabled={convert.isPending}
              >
                {convert.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Convert to invoice
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={updateStatus.isPending}>
                <XCircle className="h-4 w-4" />
                Cancel order
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={lines}
                emptyState={
                  <EmptyState
                    icon={<ClipboardList className="h-5 w-5" />}
                    title="No line items"
                    description="This order has no products yet."
                  />
                }
                columns={[
                  { key: "desc", header: "Description", cell: (l) => l.description },
                  {
                    key: "qty",
                    header: "Qty",
                    align: "right",
                    cell: (l) => <span className="tabular-nums">{Number(l.quantity)}</span>,
                  },
                  {
                    key: "price",
                    header: "Unit price",
                    align: "right",
                    cell: (l) => <MoneyDisplay value={l.unit_price} currency={order.currency} />,
                  },
                  {
                    key: "tax",
                    header: "Tax",
                    align: "right",
                    cell: (l) => <span className="text-xs text-muted-foreground">{Number(l.tax_rate)}%</span>,
                  },
                  {
                    key: "total",
                    header: "Line total",
                    align: "right",
                    cell: (l) => (
                      <MoneyDisplay
                        value={l.line_total}
                        currency={order.currency}
                        className="font-medium"
                      />
                    ),
                  },
                ]}
                footer={
                  <>
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right text-xs text-muted-foreground">
                        Subtotal
                      </td>
                      <td className="px-3 py-2 text-right">
                        <MoneyDisplay value={order.subtotal} currency={order.currency} />
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right text-xs text-muted-foreground">
                        Tax
                      </td>
                      <td className="px-3 py-2 text-right">
                        <MoneyDisplay value={order.tax_total} currency={order.currency} />
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Total
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <MoneyDisplay
                          value={order.total}
                          currency={order.currency}
                          className="text-base font-semibold"
                        />
                      </td>
                    </tr>
                  </>
                }
              />
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {customer ? (
                <>
                  <Link
                    to="/customers/$customerId"
                    params={{ customerId: customer.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {customer.name}
                  </Link>
                  {customer.email && (
                    <div className="text-xs text-muted-foreground">{customer.email}</div>
                  )}
                  {customer.phone && (
                    <div className="text-xs text-muted-foreground">{customer.phone}</div>
                  )}
                  {(customer.address_line1 || customer.city) && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {customer.address_line1}
                      {customer.address_line1 && (customer.city || customer.country) && <br />}
                      {[customer.city, customer.country].filter(Boolean).join(", ")}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Status">
                <StatusBadge status={order.status} />
              </Row>
              <Row label="Order date">{formatDate(order.order_date)}</Row>
              <Row label="Expected delivery">{formatDate(order.expected_delivery_date)}</Row>
              <Row label="Currency">{order.currency}</Row>
              <Row label="Subtotal">
                <MoneyDisplay value={order.subtotal} currency={order.currency} />
              </Row>
              <Row label="Tax">
                <MoneyDisplay value={order.tax_total} currency={order.currency} />
              </Row>
              <Row label="Total">
                <MoneyDisplay
                  value={order.total}
                  currency={order.currency}
                  className="font-semibold"
                />
              </Row>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
