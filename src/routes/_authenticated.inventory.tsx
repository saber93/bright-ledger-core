import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { Package } from "lucide-react";
import { useModuleEnabled } from "@/components/data/ModuleGate";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: () => {
    const enabled = useModuleEnabled("inventory_enabled");
    return (
      <div>
        <PageHeader title="Products & Inventory" description="Manage products, warehouses, and stock." />
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title={enabled ? "Inventory module coming soon" : "Inventory is disabled"}
          description={
            enabled
              ? "Products, warehouses, stock balances, and movements arrive in the next iteration."
              : "Enable the Inventory module from Settings → Modules to start tracking products."
          }
        />
      </div>
    );
  },
});
