import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { ShoppingBag } from "lucide-react";
import { useModuleEnabled } from "@/components/data/ModuleGate";

export const Route = createFileRoute("/_authenticated/store")({
  component: () => {
    const enabled = useModuleEnabled("online_store_enabled");
    return (
      <div>
        <PageHeader title="Online Store" description="Publish products and manage online orders." />
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title={enabled ? "Online Store coming soon" : "Online Store is disabled"}
          description={
            enabled
              ? "Storefront, checkout, shipping, and payment integration arrive next."
              : "Enable Online Store from Settings → Modules to publish your catalog."
          }
        />
      </div>
    );
  },
});
