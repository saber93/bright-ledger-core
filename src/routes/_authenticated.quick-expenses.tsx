import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { Receipt } from "lucide-react";
import { useCompanySettings } from "@/features/settings/hooks";

export const Route = createFileRoute("/_authenticated/quick-expenses")({
  component: QuickExpensesPlaceholder,
});

function QuickExpensesPlaceholder() {
  const { data: settings } = useCompanySettings();

  if (settings && !settings.quick_expenses_enabled) {
    return (
      <div>
        <PageHeader title="Quick Expenses" description="Module disabled" />
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="Quick Expenses are disabled"
          description="Enable Quick Expenses in Settings → Modules & Features to log small daily costs."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Quick Expenses"
        description="Fast capture for fuel, supplies, petty cash and other day-to-day costs."
      />
      <EmptyState
        icon={<Receipt className="h-8 w-8" />}
        title="Quick expense capture coming next"
        description="The list, smart-defaults drawer, and receipt photo upload flow ship in the next build."
      />
    </div>
  );
}
