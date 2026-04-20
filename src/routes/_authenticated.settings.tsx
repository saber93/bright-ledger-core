import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { cn } from "@/lib/utils";
import { useCompanySettings } from "@/features/settings/hooks";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const loc = useLocation();
  const { data: settings } = useCompanySettings();

  const tabs = [
    { href: "/settings", label: "Company", show: true },
    { href: "/settings/modules", label: "Modules & Features", show: true },
    { href: "/settings/users", label: "Users & Roles", show: true },
    { href: "/settings/branches", label: "Branches & Registers", show: !!settings?.pos_enabled || !!settings?.cash_sessions_enabled },
    { href: "/settings/tax-rates", label: "Tax Rates", show: !!settings?.tax_reporting_enabled },
    { href: "/settings/document-templates", label: "Document Templates", show: true },
    { href: "/settings/collections", label: "Collections & Delivery", show: true },
  ].filter((t) => t.show);

  // Render tab navigation + outlet. If at /settings root, show company info section.
  return (
    <div>
      <PageHeader title="Settings" description="Manage your workspace." />
      <div className="mb-6 flex gap-1 border-b">
        {tabs.map((t) => {
          const active =
            t.href === "/settings"
              ? loc.pathname === "/settings"
              : loc.pathname === t.href || loc.pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              to={t.href}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
