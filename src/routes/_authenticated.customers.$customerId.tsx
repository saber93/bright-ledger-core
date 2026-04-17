import { createFileRoute, Link } from "@tanstack/react-router";
import { useCustomer } from "@/features/customers/hooks";
import { useInvoicesForCustomer } from "@/features/invoices/hooks";
import { useSalesOrdersForCustomer } from "@/features/sales-orders/hooks";
import { useOnlineOrdersForEmail } from "@/features/online-orders/hooks";
import { PageHeader } from "@/components/data/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable } from "@/components/data/DataTable";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { formatDate } from "@/lib/format";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  component: CustomerDetail,
});

function CustomerDetail() {
  const { customerId } = Route.useParams();
  const { data: customer, isLoading } = useCustomer(customerId);
  const { data: invoices } = useInvoicesForCustomer(customerId);
  const { data: salesOrders } = useSalesOrdersForCustomer(customerId);
  const { data: onlineOrders } = useOnlineOrdersForEmail(customer?.email);

  if (isLoading) return <div className="py-10 text-sm text-muted-foreground">Loading…</div>;
  if (!customer) return <div className="py-10 text-sm text-muted-foreground">Not found.</div>;

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={customer.email ?? "—"}
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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Sales orders ({salesOrders?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="online">Online orders ({onlineOrders?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({invoices?.length ?? 0})</TabsTrigger>
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
      </Tabs>
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
