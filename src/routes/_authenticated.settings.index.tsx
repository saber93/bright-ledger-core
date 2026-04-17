import { createFileRoute } from "@tanstack/react-router";
import { useCompany } from "@/features/settings/hooks";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsCompany,
});

function SettingsCompany() {
  const { data: company } = useCompany();
  const { roles } = useAuth();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Workspace name" value={company?.name} />
      <Field label="Currency" value={company?.currency} />
      <Field label="Country" value={company?.country ?? "—"} />
      <Field label="Your roles" value={roles.join(", ") || "—"} />
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}
