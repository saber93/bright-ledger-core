import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { Wallet } from "lucide-react";
import { useCompanySettings } from "@/features/settings/hooks";

export const Route = createFileRoute("/_authenticated/pos")({
  component: PosPlaceholder,
});

function PosPlaceholder() {
  const { data: settings } = useCompanySettings();

  if (settings && !settings.pos_enabled) {
    return (
      <div>
        <PageHeader title="Point of Sale" description="Module disabled" />
        <EmptyState
          icon={<Wallet className="h-8 w-8" />}
          title="POS is disabled"
          description="Enable Point of Sale in Settings → Modules & Features to start ringing up sales."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Point of Sale"
        description="Counter checkout, receipts, and cash management."
      />
      <EmptyState
        icon={<Wallet className="h-8 w-8" />}
        title="POS terminal coming next"
        description="Group 1 just shipped the foundation. The full POS terminal — cart, payments, receipts, and held orders — lands in the next build."
      />
    </div>
  );
}
