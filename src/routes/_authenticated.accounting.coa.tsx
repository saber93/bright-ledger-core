import { createFileRoute } from "@tanstack/react-router";
import { useChartOfAccounts } from "@/features/accounting/hooks";
import { PageHeader } from "@/components/data/PageHeader";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/accounting/coa")({
  component: COAPage,
});

const typeLabels: Record<string, { label: string; color: string }> = {
  asset: { label: "Asset", color: "bg-info/10 text-info" },
  liability: { label: "Liability", color: "bg-warning/15 text-warning-foreground" },
  equity: { label: "Equity", color: "bg-primary/10 text-primary" },
  income: { label: "Income", color: "bg-success/10 text-success" },
  expense: { label: "Expense", color: "bg-destructive/10 text-destructive" },
};

function COAPage() {
  const { data, isLoading } = useChartOfAccounts();

  return (
    <div>
      <PageHeader
        title="Chart of Accounts"
        description="The structure of your financial books."
      />
      <DataTable
        loading={isLoading}
        data={data}
        emptyState={
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="No accounts yet"
            description="Your chart of accounts will appear here."
          />
        }
        columns={[
          {
            key: "code",
            header: "Code",
            width: "120px",
            cell: (r) => <span className="font-mono text-sm font-medium">{r.code}</span>,
          },
          { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
          {
            key: "type",
            header: "Type",
            cell: (r) => {
              const t = typeLabels[r.type];
              return (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t.color}`}>
                  {t.label}
                </span>
              );
            },
          },
          {
            key: "active",
            header: "Status",
            align: "right",
            cell: (r) => (
              <span className="text-xs text-muted-foreground">
                {r.is_active ? "Active" : "Inactive"}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
