import { createFileRoute, Link } from "@tanstack/react-router";
import { useCompanySettings, useUpdateSettings } from "@/features/settings/hooks";
import { useFinancePermissions } from "@/features/accounting/permissions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Package,
  ShoppingBag,
  CreditCard,
  BarChart3,
  Calculator,
  Wallet,
  Banknote,
  Receipt,
  Undo2,
  Tag,
} from "lucide-react";
import { type ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/settings/modules")({
  component: ModulesPage,
});

function ModulesPage() {
  const { data } = useCompanySettings();
  const update = useUpdateSettings();
  const finance = useFinancePermissions();

  const set = async (patch: Record<string, boolean>) => {
    if (!finance.canChangeSensitiveSettings) {
      toast.error("Only owners can change finance-sensitive settings.");
      return;
    }
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
    <div className="space-y-6">
      <Section title="Core modules">
        <div className="grid gap-3 md:grid-cols-2">
          <ModuleCard
            icon={<Calculator className="h-5 w-5" />}
            title="Accounting"
            description="Customer invoices, supplier bills, payments, and chart of accounts."
            checked={data.accounting_enabled}
            disabled={!finance.canChangeSensitiveSettings}
            onChange={(v) => set({ accounting_enabled: v })}
          />
          <ModuleCard
            icon={<Package className="h-5 w-5" />}
            title="Inventory"
            description="Track products, warehouses, and stock balances."
            checked={data.inventory_enabled}
            disabled={!finance.canChangeSensitiveSettings}
            onChange={(v) => set({ inventory_enabled: v })}
          />
          <ModuleCard
            icon={<BarChart3 className="h-5 w-5" />}
            title="Stock Tracking"
            description="Record stock movements with full traceability."
            checked={data.stock_tracking_enabled}
            disabled={!finance.canChangeSensitiveSettings}
            onChange={(v) => set({ stock_tracking_enabled: v })}
          />
          <ModuleCard
            icon={<ShoppingBag className="h-5 w-5" />}
            title="Online Store"
            description="Publish products, manage online orders, and run a storefront."
            checked={data.online_store_enabled}
            disabled={!finance.canChangeSensitiveSettings}
            onChange={(v) => set({ online_store_enabled: v })}
          />
          <ModuleCard
            icon={<CreditCard className="h-5 w-5" />}
            title="Online Payments"
            description="Accept payments via gateways with webhook processing."
            checked={data.online_payments_enabled}
            disabled={!finance.canChangeSensitiveSettings}
            onChange={(v) => set({ online_payments_enabled: v })}
          />
        </div>
      </Section>

      <Section title="Daily operations" subtitle="Built for shops, salons, cafés, and field teams.">
        <div className="grid gap-3 md:grid-cols-2">
          <ModuleCard
            icon={<Wallet className="h-5 w-5" />}
            title="Point of Sale"
            description="Fast counter checkout with receipts, cash & card, and inventory sync."
            checked={data.pos_enabled}
            disabled={!finance.canChangeSensitiveSettings}
            onChange={(v) => set({ pos_enabled: v })}
          />
          <ModuleCard
            icon={<Receipt className="h-5 w-5" />}
            title="Quick Expenses"
            description="Log small daily expenses with receipt photos and smart defaults."
            checked={data.quick_expenses_enabled}
            disabled={!finance.canChangeSensitiveSettings}
            onChange={(v) => set({ quick_expenses_enabled: v })}
          />
          <ModuleCard
            icon={<Banknote className="h-5 w-5" />}
            title="Cash Sessions"
            description="Open and close cash drawer shifts with reconciliation and variance."
            checked={data.cash_sessions_enabled}
            disabled={!finance.canChangeSensitiveSettings}
            onChange={(v) => set({ cash_sessions_enabled: v })}
          />
          <ModuleCard
            icon={<Undo2 className="h-5 w-5" />}
            title="Refunds & Credit Notes"
            description="Issue partial or full refunds with cash, credit, or invoice allocation."
            checked={data.refunds_enabled}
            disabled={!finance.canChangeSensitiveSettings}
            onChange={(v) => set({ refunds_enabled: v })}
          />
          <ModuleCard
            icon={<Tag className="h-5 w-5" />}
            title="Tax Reporting"
            description="Configurable tax rates and a tax summary report."
            checked={data.tax_reporting_enabled}
            disabled={!finance.canChangeSensitiveSettings}
            onChange={(v) => set({ tax_reporting_enabled: v })}
          />
        </div>
      </Section>

      <Section title="POS preferences">
        <div className="grid gap-3">
          <ModuleCard
            icon={<Tag className="h-5 w-5" />}
            title="Allow price override at POS"
            description="Cashiers can edit unit price at checkout (a reason will be required)."
            checked={data.pos_allow_price_override}
            disabled={!finance.canChangeSensitiveSettings}
            onChange={(v) => set({ pos_allow_price_override: v })}
          />
        </div>
      </Section>

      <Section
        title="Accounting Controls"
        subtitle="Period close, reopen, finance exceptions, and audit history now live in one controlled workflow."
      >
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            The old lock-through date is now a mirrored legacy field. Close and reopen books from
            Accounting Controls so period state, audit history, and posting exceptions stay in sync.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/accounting/controls">Open accounting controls</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/reports/trial-balance">Review Trial Balance</Link>
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
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
  disabled?: boolean;
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
          <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
