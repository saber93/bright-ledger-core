import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { Banknote } from "lucide-react";
import { useCompanySettings } from "@/features/settings/hooks";

export const Route = createFileRoute("/_authenticated/cash-sessions")({
  component: CashSessionsPlaceholder,
});

function CashSessionsPlaceholder() {
  const { data: settings } = useCompanySettings();

  if (settings && !settings.cash_sessions_enabled) {
    return (
      <div>
        <PageHeader title="Cash Sessions" description="Module disabled" />
        <EmptyState
          icon={<Banknote className="h-8 w-8" />}
          title="Cash sessions are disabled"
          description="Enable Cash Sessions in Settings → Modules & Features to track register shifts."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Cash Sessions"
        description="Open and close register shifts with reconciliation."
      />
      <EmptyState
        icon={<Banknote className="h-8 w-8" />}
        title="Cash session flows coming next"
        description="The open/close flow with cash counting and variance reconciliation lands with the POS terminal in the next build."
      />
    </div>
  );
}
