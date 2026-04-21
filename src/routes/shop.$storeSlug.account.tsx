import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Clock3, CreditCard, FileText, Receipt, Wallet } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data/DataTable";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePortalAccount, usePortalInvoicePayment } from "@/features/storefront/hooks";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/shop/$storeSlug/account")({
  component: StorefrontAccountPage,
});

function StorefrontAccountPage() {
  const { storeSlug } = Route.useParams();
  const location = useLocation();
  const accountPath = `/shop/${storeSlug}/account`;
  const isAccountIndex = location.pathname === accountPath;
  const navigate = useNavigate();
  const query = usePortalAccount(isAccountIndex ? storeSlug : "");
  const payInvoice = usePortalInvoicePayment();

  if (!isAccountIndex) {
    return <Outlet />;
  }

  if (query.isLoading) {
    return <div className="py-16 text-sm text-muted-foreground">Loading account…</div>;
  }

  if (query.error || !query.data) {
    return (
      <div className="rounded-[32px] border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Access your customer account</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Use your email, order number, and postal code to continue.
        </p>
        <div className="mt-6">
          <Button asChild className="rounded-full px-6">
            <Link to="/shop/$storeSlug/account/access" params={{ storeSlug }}>
              Continue
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const { shell, account } = query.data;
  const design = shell.design;

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">My account</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{account.customer.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Orders, invoices, credits, and statement visibility in one customer-safe workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              window.location.href = `/api/storefront/account/document?storeSlug=${encodeURIComponent(storeSlug)}&documentType=customer_statement&documentId=${encodeURIComponent(account.customer.id)}`;
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            Print statement
          </Button>
        </div>
      </div>

      <div className={`grid gap-4 ${design.commerce.accountStyle === "list" ? "md:grid-cols-2" : "md:grid-cols-4"}`}>
        <AccountMetric icon={Receipt} label="Orders" value={String(account.orders.length)} />
        <AccountMetric
          icon={CreditCard}
          label="Open balance"
          value={<MoneyDisplay value={account.totalDue} currency={account.currency} />}
        />
        <AccountMetric
          icon={Wallet}
          label="Available credit"
          value={<MoneyDisplay value={account.availableCredit} currency={account.currency} />}
        />
        <AccountMetric
          icon={Clock3}
          label="Recent payments"
          value={String(account.recentPayments.length)}
        />
      </div>

      {account.totalDue > 0 ? (
        <Alert>
          <CreditCard className="h-4 w-4" />
          <AlertTitle>Outstanding balance</AlertTitle>
          <AlertDescription>
            You currently have{" "}
            <span className="font-medium">{`${account.currency} ${account.totalDue.toFixed(2)}`}</span>{" "}
            due across open invoices. You can settle them directly from the invoice list below.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.08fr,0.92fr]">
        <Tabs defaultValue="orders" className="min-w-0">
          <TabsList className={design.commerce.accountStyle === "list" ? "h-auto flex-wrap justify-start" : undefined}>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="credits">Credits</TabsTrigger>
            <TabsTrigger value="statement">Statement</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-4">
            <DataTable
              data={account.orders}
              emptyState={
                <div className="rounded-[28px] border border-dashed border-border/80 bg-card/60 p-10 text-center text-sm text-muted-foreground">
                  No storefront orders yet.
                </div>
              }
              onRowClick={(row) =>
                navigate({ to: "/shop/$storeSlug/order/$orderId", params: { storeSlug, orderId: row.id } })
              }
              columns={[
                {
                  key: "number",
                  header: "Order",
                  cell: (row) => <span className="font-mono text-xs">{row.orderNumber}</span>,
                },
                { key: "placed", header: "Placed", cell: (row) => formatDate(row.placedAt) },
                { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
                {
                  key: "payment",
                  header: "Payment",
                  cell: (row) => (
                    <span className="capitalize text-muted-foreground">
                      {row.paymentState === "paid" ? "Paid" : row.paymentMethod ?? "Pending"}
                    </span>
                  ),
                },
                {
                  key: "total",
                  header: "Total",
                  align: "right",
                  cell: (row) => <MoneyDisplay value={row.total} currency={row.currency} />,
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <DataTable
              data={account.invoices}
              emptyState={
                <div className="rounded-[28px] border border-dashed border-border/80 bg-card/60 p-10 text-center text-sm text-muted-foreground">
                  No invoices yet.
                </div>
              }
              columns={[
                {
                  key: "number",
                  header: "Invoice",
                  cell: (row) => <span className="font-mono text-xs">{row.invoiceNumber}</span>,
                },
                { key: "issue", header: "Issued", cell: (row) => formatDate(row.issueDate) },
                { key: "due", header: "Due", cell: (row) => formatDate(row.dueDate) },
                { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
                {
                  key: "balance",
                  header: "Balance",
                  align: "right",
                  cell: (row) => <MoneyDisplay value={row.balanceDue} currency={row.currency} />,
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  cell: (row) => (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={(event) => {
                          event.stopPropagation();
                          window.location.href = `/api/storefront/account/document?storeSlug=${encodeURIComponent(storeSlug)}&documentType=invoice&documentId=${encodeURIComponent(row.id)}`;
                        }}
                      >
                        Print
                      </Button>
                      {row.balanceDue > 0.005 ? (
                        <Button
                          size="sm"
                          className="rounded-full"
                          disabled={payInvoice.isPending}
                          onClick={async (event) => {
                            event.stopPropagation();
                            try {
                              const result = await payInvoice.mutateAsync({ storeSlug, invoiceId: row.id });
                              if (result.redirectUrl) {
                                window.location.href = result.redirectUrl;
                                return;
                              }
                              toast.success(`Invoice ${row.invoiceNumber} paid`);
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Payment failed");
                            }
                          }}
                        >
                          Pay now
                        </Button>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="credits" className="mt-4">
            <DataTable
              data={account.credits}
              emptyState={
                <div className="rounded-[28px] border border-dashed border-border/80 bg-card/60 p-10 text-center text-sm text-muted-foreground">
                  No credits or refunds yet.
                </div>
              }
              columns={[
                {
                  key: "number",
                  header: "Credit note",
                  cell: (row) => <span className="font-mono text-xs">{row.creditNoteNumber}</span>,
                },
                { key: "issue", header: "Issued", cell: (row) => formatDate(row.issueDate) },
                { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
                {
                  key: "total",
                  header: "Total",
                  align: "right",
                  cell: (row) => <MoneyDisplay value={row.total} currency={row.currency} />,
                },
                {
                  key: "actions",
                  header: "",
                  align: "right",
                  cell: (row) => (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        window.location.href = `/api/storefront/account/document?storeSlug=${encodeURIComponent(storeSlug)}&documentType=credit_note&documentId=${encodeURIComponent(row.id)}`;
                      }}
                    >
                      Print
                    </Button>
                  ),
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="statement" className="mt-4">
            <div
              className="border bg-card p-6 shadow-sm"
              style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Statement summary</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Open invoices, recent payments, and available credit in one view.
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    window.location.href = `/api/storefront/account/document?storeSlug=${encodeURIComponent(storeSlug)}&documentType=customer_statement&documentId=${encodeURIComponent(account.customer.id)}`;
                  }}
                >
                  Print statement
                </Button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <StatementCard label="Total due" value={<MoneyDisplay value={account.totalDue} currency={account.currency} />} />
                <StatementCard label="Available credit" value={<MoneyDisplay value={account.availableCredit} currency={account.currency} />} />
                <StatementCard label="Recent payments" value={String(account.recentPayments.length)} />
              </div>

              <div className="mt-6 rounded-[24px] border border-border/70 bg-muted/30 p-4">
                <div className="text-sm font-medium">Recent payment activity</div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {account.recentPayments.length ? (
                    account.recentPayments.slice(0, 6).map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between gap-3">
                        <span>{formatDateTime(payment.paidAt)} · {payment.method}</span>
                        <span>{formatMoney(payment.amount, account.currency)}</span>
                      </div>
                    ))
                  ) : (
                    <div>No recent payments recorded yet.</div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <aside className="space-y-4">
          <div
            className="border bg-card p-6 shadow-sm"
            style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
          >
            <div className="text-lg font-semibold">Saved details</div>
            <dl className="mt-5 space-y-3 text-sm">
              <FieldRow label="Email" value={account.customer.email} />
              <FieldRow label="Phone" value={account.customer.phone} />
              <FieldRow label="Address" value={account.customer.addressLine1} />
              <FieldRow
                label="City / Country"
                value={[account.customer.city, account.customer.country].filter(Boolean).join(", ")}
              />
            </dl>
          </div>

          <div
            className="border bg-card p-6 shadow-sm"
            style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
          >
            <div className="text-lg font-semibold">Latest shipping destination</div>
            <div className="mt-4 text-sm text-muted-foreground">
              {account.latestShippingAddress
                ? [
                    account.latestShippingAddress.line1,
                    [account.latestShippingAddress.city, account.latestShippingAddress.postalCode]
                      .filter(Boolean)
                      .join(" "),
                    account.latestShippingAddress.country,
                  ]
                    .filter(Boolean)
                    .join(", ")
                : "No storefront shipping destination yet."}
            </div>
            <div className="mt-5">
              <Button variant="outline" className="rounded-full" asChild>
                <Link to="/shop/$storeSlug" params={{ storeSlug }}>
                  Keep shopping
                </Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AccountMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className="border bg-card p-5 shadow-sm"
      style={{ borderRadius: "var(--store-radius-card)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
    >
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function StatementCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className="border bg-background/80 p-4"
      style={{ borderRadius: "var(--store-radius-soft)", borderColor: "rgba(var(--store-primary-rgb), 0.10)" }}
    >
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right">{value || "—"}</dd>
    </div>
  );
}
