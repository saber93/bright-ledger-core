import { createFileRoute } from "@tanstack/react-router";
import { useBills } from "@/features/bills/hooks";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/data/PageHeader";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { StatusBadge } from "@/components/data/StatusBadge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receipt, Plus } from "lucide-react";
import { formatDate } from "@/lib/format";
import { openDocument } from "@/lib/open-document";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bills")({
  component: BillsPage,
});

function BillsPage() {
  const { data, isLoading } = useBills();
  const { company } = useAuth();
  const [search, setSearch] = useState("");
  const filtered = (data ?? []).filter(
    (b) =>
      b.bill_number.toLowerCase().includes(search.toLowerCase()) ||
      b.supplier_name.toLowerCase().includes(search.toLowerCase()),
  );
  const totalSum = filtered.reduce((s, b) => s + Number(b.total), 0);
  const currency = company?.currency ?? "USD";

  return (
    <div>
      <PageHeader
        title="Supplier Bills"
        description="Record bills from suppliers and track payables."
        actions={
          <Button onClick={() => toast.info("Bill creation drawer coming next iteration — schema is ready.")}>
            <Plus className="h-4 w-4" /> New bill
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="max-w-sm"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} bills</span>
      </div>

      <DataTable
        loading={isLoading}
        data={filtered}
        onRowClick={(r) =>
          void openDocument(`/api/documents/bill/${r.id}`)
        }
        emptyState={
          <EmptyState
            icon={<Receipt className="h-5 w-5" />}
            title="No bills yet"
            description="Record your first supplier bill."
          />
        }
        columns={[
          {
            key: "number",
            header: "Number",
            cell: (r) => <span className="font-mono text-xs font-medium">{r.bill_number}</span>,
          },
          { key: "supplier", header: "Supplier", cell: (r) => r.supplier_name },
          { key: "issue", header: "Issued", cell: (r) => formatDate(r.issue_date) },
          { key: "due", header: "Due", cell: (r) => formatDate(r.due_date) },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          {
            key: "paid",
            header: "Paid",
            align: "right",
            cell: (r) => <MoneyDisplay value={r.amount_paid} currency={r.currency} muted />,
          },
          {
            key: "total",
            header: "Total",
            align: "right",
            cell: (r) => <MoneyDisplay value={r.total} currency={r.currency} />,
          },
        ]}
        footer={
          <tr>
            <td colSpan={6} className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total
            </td>
            <td className="px-3 py-2.5 text-right">
              <MoneyDisplay value={totalSum} currency={currency} className="font-semibold" />
            </td>
          </tr>
        }
      />
    </div>
  );
}
