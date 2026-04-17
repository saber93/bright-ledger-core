import { createFileRoute } from "@tanstack/react-router";
import { usePayments } from "@/features/payments/hooks";
import { PageHeader } from "@/components/data/PageHeader";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { CreditCard } from "lucide-react";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const { data, isLoading } = usePayments();

  return (
    <div>
      <PageHeader
        title="Payments"
        description="All money in and out — manual entries and gateway transactions."
      />

      <DataTable
        loading={isLoading}
        data={data}
        emptyState={
          <EmptyState
            icon={<CreditCard className="h-5 w-5" />}
            title="No payments yet"
            description="Payments will appear here as invoices and bills are settled."
          />
        }
        columns={[
          {
            key: "direction",
            header: "Direction",
            cell: (r) => (
              <span
                className={
                  r.direction === "in"
                    ? "inline-flex items-center gap-1 text-xs font-medium text-success"
                    : "inline-flex items-center gap-1 text-xs font-medium text-warning-foreground"
                }
              >
                {r.direction === "in" ? "↓ Received" : "↑ Sent"}
              </span>
            ),
          },
          { key: "method", header: "Method", cell: (r) => r.method.replace("_", " ") },
          {
            key: "ref",
            header: "Reference",
            cell: (r) => <span className="font-mono text-xs">{r.reference ?? "—"}</span>,
          },
          { key: "date", header: "Date", cell: (r) => formatDate(r.paid_at) },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            cell: (r) => (
              <MoneyDisplay
                value={r.amount}
                currency={r.currency}
                className={r.direction === "in" ? "text-success" : ""}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
