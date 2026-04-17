import { createFileRoute } from "@tanstack/react-router";
import { useCompanySettings, useUpdateSettings } from "@/features/settings/hooks";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Package, ShoppingBag, CreditCard, BarChart3 } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/settings/modules")({
  component: ModulesPage,
});

function ModulesPage() {
  const { data } = useCompanySettings();
  const update = useUpdateSettings();

  const set = async (patch: Record<string, boolean>) => {
    try {
      await update.mutateAsync(patch);
      toast.success("Settings updated");
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Failed");
    }
  };

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ModuleCard
        icon={<Package className="h-5 w-5" />}
        title="Inventory"
        description="Track products, warehouses, and stock balances."
        checked={data.inventory_enabled}
        onChange={(v) => set({ inventory_enabled: v })}
      />
      <ModuleCard
        icon={<BarChart3 className="h-5 w-5" />}
        title="Stock Tracking"
        description="Record stock movements with full traceability."
        checked={data.stock_tracking_enabled}
        onChange={(v) => set({ stock_tracking_enabled: v })}
      />
      <ModuleCard
        icon={<ShoppingBag className="h-5 w-5" />}
        title="Online Store"
        description="Publish products, manage online orders, and run a storefront."
        checked={data.online_store_enabled}
        onChange={(v) => set({ online_store_enabled: v })}
      />
      <ModuleCard
        icon={<CreditCard className="h-5 w-5" />}
        title="Online Payments"
        description="Accept payments via gateways with webhook processing."
        checked={data.online_payments_enabled}
        onChange={(v) => set({ online_payments_enabled: v })}
      />
    </div>
  );
}

function ModuleCard({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border bg-card p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-semibold">{title}</Label>
          <Switch checked={checked} onCheckedChange={onChange} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
