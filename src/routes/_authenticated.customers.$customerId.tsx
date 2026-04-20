import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCustomer } from "@/features/customers/hooks";
import { useInvoicesForCustomer } from "@/features/invoices/hooks";
import { useSalesOrdersForCustomer } from "@/features/sales-orders/hooks";
import { useOnlineOrdersForEmail } from "@/features/online-orders/hooks";
import {
  useCreditNotesForCustomer,
  useCustomerCreditBalance,
} from "@/features/refunds/hooks";
import { PageHeader } from "@/components/data/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable } from "@/components/data/DataTable";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { Badge } from "@/components/ui/badge";
import { DocumentCommunicationCard } from "@/components/delivery/DocumentCommunicationCard";
import { SendDocumentDialog } from "@/components/delivery/SendDocumentDialog";
import type { DocumentDelivery } from "@/features/delivery/hooks";
import { useFinancePermissions } from "@/features/accounting/permissions";
import { Button } from "@/components/ui/button";
import { Wallet, ChevronRight, Printer, Mail } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import { openDocument } from "@/lib/open-document";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  component: CustomerDetail,
});

function CustomerDetail() {
  const { customerId } = Route.useParams();
  const { data: customer, isLoading } = useCustomer(customerId);
  const { data: invoices } = useInvoicesForCustomer(customerId);
  const { data: salesOrders } = useSalesOrdersForCustomer(customerId);
  const { data: onlineOrders } = useOnlineOrdersForEmail(customer?.email);
  const { data: creditBalance } = useCustomerCreditBalance(customerId);
  const { data: creditNotes } = useCreditNotesForCustomer(customerId);
  const { company } = useAuth();
  const finance = useFinancePermissions();
  const [sendOpen, setSendOpen] = useState(false);
  const [deliverySeed, setDeliverySeed] = useState<{
    recipient?: string | null;
    recipientName?: string | null;
    subject?: string | null;
    message?: string | null;
    templateKey?: "customer_statement";
  } | null>(null);

  if (isLoading) return <div className="py-10 text-sm text-muted-foreground">Loading…</div>;
  if (!customer) return <div className="py-10 text-sm text-muted-foreground">Not found.</div>;

  const balance = Number(creditBalance?.balance ?? 0);
  const balanceCurrency = creditBalance?.currency ?? customer.currency ?? "USD";
  const openInvoices = (invoices ?? []).filter((invoice) => {
    const remaining = Number(invoice.total) - Number(invoice.amount_paid);
    return invoice.status !== "cancelled" && remaining > 0.005;
  });
  const totalDue = openInvoices.reduce(
    (sum, invoice) => sum + Math.max(0, Number(invoice.total) - Number(invoice.amount_paid)),
    0,
  );

  function openSend(seed?: DocumentDelivery) {
    setDeliverySeed(
      seed
        ? {
            recipient: seed.recipient,
            recipientName: seed.recipient_name,
            subject: seed.subject,
            message: seed.message,
            templateKey: "customer_statement",
          }
        : null,
    );
    setSendOpen(true);
  }

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={customer.email ?? "—"}
        actions={
          finance.canManageCollections ? (
            <>
              <Button
                variant="outline"
                onClick={() => void openDocument(`/api/documents/customer-statement/${customer.id}`)}
              >
                <Printer className="mr-1 h-4 w-4" /> Print statement
              </Button>
              <Button variant="outline" onClick={() => openSend()}>
                <Mail className="mr-1 h-4 w-4" /> Send statement
              </Button>
            </>
          ) : undefined
        }
        breadcrumbs={
          <span className="inline-flex items-center gap-1">
            <Link to="/customers" className="hover:text-foreground">
              Customers
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span>{customer.name}</span>
          </span>
        }
      />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div
          className={`rounded-xl border p-5 ${
            balance > 0 ? "border-primary/40 bg-primary/5" : "bg-card"
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Store credit balance
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <MoneyDisplay
              value={balance}
              currency={balanceCurrency}
              className={`text-2xl font-semibold ${balance > 0 ? "text-primary" : "text-foreground"}`}
            />
            {balance > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                Available
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            From issued credit notes allocated to customer credit.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Open invoices
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {(invoices ?? []).filter((i) => i.status !== "paid" && i.status !== "cancelled").length}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Across all invoices.</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Credit notes
          </div>
          <div className="mt-2 text-2xl font-semibold">{creditNotes?.length ?? 0}</div>
          <p className="mt-1 text-xs text-muted-foreground">Refunds & credits issued.</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Sales orders ({salesOrders?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="online">Online orders ({onlineOrders?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({invoices?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="credits">Credits & refunds ({creditNotes?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="statement">Statement</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Email" value={customer.email} />
            <Field label="Phone" value={customer.phone} />
            <Field label="Tax ID" value={customer.tax_id} />
            <Field label="Currency" value={customer.currency} />
            <Field label="Address" value={customer.address_line1} />
            <Field label="City / Country" value={[customer.city, customer.country].filter(Boolean).join(", ")} />
          </div>
          {customer.notes && (
            <div className="mt-6 rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold">Notes</h3>
              <p className="mt-2 text-sm text-muted-foreground">{customer.notes}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <DataTable
            data={salesOrders}
            onRowClick={(r) => {
              window.location.href = `/sales/${r.id}`;
            }}
            emptyState={
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                No sales orders for this customer yet.
              </div>
            }
            columns={[
              {
                key: "number",
                header: "Number",
                cell: (r) => <span className="font-mono text-xs">{r.order_number}</span>,
              },
              { key: "date", header: "Order date", cell: (r) => formatDate(r.order_date) },
              {
                key: "delivery",
                header: "Expected",
                cell: (r) => formatDate(r.expected_delivery_date),
              },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              {
                key: "total",
                header: "Total",
                align: "right",
                cell: (r) => <MoneyDisplay value={r.total} currency={r.currency} />,
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="online" className="mt-4">
          <DataTable
            data={onlineOrders}
            onRowClick={(r) => {
              window.location.href = `/store/${r.id}`;
            }}
            emptyState={
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                {customer.email
                  ? "No online orders matched this customer's email."
                  : "Add an email to this customer to match online orders."}
              </div>
            }
            columns={[
              {
                key: "number",
                header: "Number",
                cell: (r) => <span className="font-mono text-xs">{r.order_number}</span>,
              },
              { key: "placed", header: "Placed", cell: (r) => formatDate(r.placed_at) },
              {
                key: "name",
                header: "Name on order",
                cell: (r) => <span className="text-sm">{r.customer_name}</span>,
              },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              {
                key: "total",
                header: "Total",
                align: "right",
                cell: (r) => <MoneyDisplay value={r.total} currency={r.currency} />,
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <DataTable
            data={invoices}
            emptyState={
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                No invoices for this customer yet.
              </div>
            }
            columns={[
              {
                key: "number",
                header: "Number",
                cell: (r) => <span className="font-mono text-xs">{r.invoice_number}</span>,
              },
              { key: "issue", header: "Issued", cell: (r) => formatDate(r.issue_date) },
              { key: "due", header: "Due", cell: (r) => formatDate(r.due_date) },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              {
                key: "total",
                header: "Total",
                align: "right",
                cell: (r) => <MoneyDisplay value={r.total} currency={r.currency} />,
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="credits" className="mt-4">
          <div className="mb-4 rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Current store credit
                </p>
                <MoneyDisplay
                  value={balance}
                  currency={balanceCurrency}
                  className="mt-1 text-2xl font-semibold"
                />
              </div>
              <Wallet className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Balance updates automatically when credit notes are allocated to customer credit
              or when credit is applied to invoices.
            </p>
          </div>

          <DataTable
            data={creditNotes}
            onRowClick={(r) => {
              window.location.href = `/refunds/${r.id}`;
            }}
            emptyState={
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                No credit notes for this customer yet.
              </div>
            }
            columns={[
              {
                key: "number",
                header: "Number",
                cell: (r) => <span className="font-mono text-xs">{r.credit_note_number}</span>,
              },
              { key: "date", header: "Issued", cell: (r) => formatDate(r.issue_date) },
              {
                key: "source",
                header: "Source",
                cell: (r) => {
                  type SrcRow = typeof r & {
                    customer_invoices: { invoice_number: string } | null;
                    pos_orders: { order_number: string } | null;
                  };
                  const row = r as SrcRow;
                  const label =
                    row.customer_invoices?.invoice_number ??
                    row.pos_orders?.order_number ??
                    "—";
                  return (
                    <span className="text-xs">
                      <span className="capitalize text-muted-foreground">{r.source_type}</span>
                      <span className="ml-1 font-mono">{label}</span>
                    </span>
                  );
                },
              },
              {
                key: "status",
                header: "Status",
                cell: (r) => (
                  <Badge variant="secondary" className="capitalize">
                    {String(r.status).replace("_", " ")}
                  </Badge>
                ),
              },
              {
                key: "total",
                header: "Total",
                align: "right",
                cell: (r) => <MoneyDisplay value={r.total} currency={balanceCurrency} />,
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="statement" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total due
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {formatMoney(totalDue, balanceCurrency)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Across {openInvoices.length} open invoice{openInvoices.length === 1 ? "" : "s"}.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Available credit
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {formatMoney(balance, balanceCurrency)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Credit note balance available for future allocation.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Net customer position
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {formatMoney(totalDue - balance, balanceCurrency)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Open invoices less available credit as of today.
              </p>
            </div>
          </div>

          <DocumentCommunicationCard
            documentType="customer_statement"
            documentId={customer.id}
            title="Statement delivery history"
            actions={
              finance.canManageCollections ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void openDocument(`/api/documents/customer-statement/${customer.id}`)}
                  >
                    <Printer className="mr-1 h-3.5 w-3.5" /> Print
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openSend()}>
                    <Mail className="mr-1 h-3.5 w-3.5" /> Send
                  </Button>
                </div>
              ) : undefined
            }
            onResend={(delivery) => openSend(delivery)}
          />
        </TabsContent>
      </Tabs>

      <SendDocumentDialog
        open={sendOpen}
        onOpenChange={(open) => {
          if (!open) setDeliverySeed(null);
          setSendOpen(open);
        }}
        title="Send customer statement"
        description="Send a current account summary with open invoices, recent payments, and available credit."
        documentType="customer_statement"
        documentId={customer.id}
        eventType="statement"
        templateOptions={[{ key: "customer_statement", label: "Customer statement email" }]}
        defaultRecipient={customer.email}
        defaultRecipientName={customer.name}
        variables={{
          company_name: company?.name,
          recipient_name: customer.name,
          customer_name: customer.name,
          document_label: "statement",
          document_number: `STATEMENT-${new Date().toISOString().slice(0, 10)}`,
          document_date: formatDate(new Date().toISOString()),
          statement_total_due: formatMoney(totalDue, balanceCurrency),
          available_credit: formatMoney(balance, balanceCurrency),
          balance_due: formatMoney(totalDue, balanceCurrency),
        }}
        seed={deliverySeed}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}
