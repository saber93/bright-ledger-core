import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { Undo2 } from "lucide-react";
import { useCompanySettings } from "@/features/settings/hooks";

export const Route = createFileRoute("/_authenticated/refunds")({
  component: RefundsPlaceholder,
});

function RefundsPlaceholder() {
  const { data: settings } = useCompanySettings();

  if (settings && !settings.refunds_enabled) {
    return (
      <div>
        <PageHeader title="Refunds" description="Module disabled" />
        <EmptyState
          icon={<Undo2 className="h-8 w-8" />}
          title="Refunds are disabled"
          description="Enable Refunds & Credit Notes in Settings → Modules & Features to start issuing refunds."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Refunds" description="Credit notes against invoices and POS orders." />
      <EmptyState
        icon={<Undo2 className="h-8 w-8" />}
        title="Refunds workflow coming next"
        description="The full refund flow — partial returns, customer credit, cash refunds — ships in the next build."
      />
    </div>
  );
}
