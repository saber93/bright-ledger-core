import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  FileText,
  PieChart,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsIndexPage,
});

interface Tile {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  desc: string;
  available: boolean;
}

const tiles: Tile[] = [
  {
    href: "/reports/profit-loss",
    icon: TrendingUp,
    name: "Profit & Loss",
    desc: "Revenue, expenses, refunds and net profit for the period.",
    available: true,
  },
  {
    href: "/reports/sales",
    icon: BarChart3,
    name: "Sales Performance",
    desc: "Sales by customer, branch and channel.",
    available: true,
  },
  {
    href: "/reports/tax",
    icon: PieChart,
    name: "Tax Summary",
    desc: "Output tax, input tax, refunds and net payable.",
    available: true,
  },
  {
    href: "/reports/cash-flow",
    icon: Wallet,
    name: "Cash Flow",
    desc: "Cash in and out across all payment methods.",
    available: true,
  },
  {
    href: "/reports/ledger",
    icon: BookOpen,
    name: "General Ledger",
    desc: "Account drill-down with journal lines and running balance.",
    available: true,
  },
  {
    href: "/reports/balance-sheet",
    icon: FileText,
    name: "Balance Sheet",
    desc: "Assets, liabilities, and equity.",
    available: true,
  },
  {
    href: "/reports/trial-balance",
    icon: Scale,
    name: "Trial Balance",
    desc: "All ledger account balances.",
    available: true,
  },
];

function ReportsIndexPage() {
  return (
    <div>
      <PageHeader title="Reports" description="Drill into your financial performance." />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => {
          const inner = (
            <>
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <t.icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-foreground">{t.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
              {t.available ? (
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Open report <ArrowRight className="h-3 w-3" />
                </p>
              ) : (
                <p className="mt-3 text-xs font-medium text-muted-foreground">Coming soon</p>
              )}
            </>
          );

          if (t.available && t.href) {
            return (
              <Link
                key={t.name}
                to={t.href}
                className="group rounded-xl border bg-card p-5 text-left transition-shadow hover:shadow-[var(--shadow-elevated)]"
              >
                {inner}
              </Link>
            );
          }
          return (
            <div
              key={t.name}
              className="rounded-xl border bg-card p-5 text-left opacity-70"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
