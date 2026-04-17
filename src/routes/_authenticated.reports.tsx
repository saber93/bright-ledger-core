import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { BarChart3, FileText, TrendingUp, PieChart, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

const reports = [
  { icon: TrendingUp, name: "Profit & Loss", desc: "Income vs expense by period." },
  { icon: Wallet, name: "Balance Sheet", desc: "Assets, liabilities, and equity." },
  { icon: BarChart3, name: "Cash Flow", desc: "Movement of cash across activities." },
  { icon: FileText, name: "Trial Balance", desc: "All ledger account balances." },
  { icon: PieChart, name: "Sales Performance", desc: "Revenue by customer & period." },
  { icon: PieChart, name: "Tax Summary", desc: "Taxes collected and owed." },
];

function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="Drill into your financial performance." />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <button
            key={r.name}
            className="group rounded-xl border bg-card p-5 text-left transition-shadow hover:shadow-[var(--shadow-elevated)]"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <r.icon className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold text-foreground">{r.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
            <p className="mt-3 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Coming soon →
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
