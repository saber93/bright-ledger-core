import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useCollectionPolicy,
  useDeliverySuppressions,
  useToggleDeliverySuppression,
  useUpdateCollectionPolicy,
  useUpsertDeliverySuppression,
} from "@/features/delivery/collections";
import { useFinancePermissions } from "@/features/accounting/permissions";
import type { DeliveryTemplateKey } from "@/features/delivery/templates";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings/collections")({
  component: CollectionsSettingsPage,
});

const templateOptions: Array<{ key: DeliveryTemplateKey; label: string }> = [
  { key: "invoice_email", label: "Invoice email" },
  { key: "reminder_friendly", label: "Friendly reminder" },
  { key: "reminder_overdue", label: "Overdue reminder" },
  { key: "reminder_final", label: "Final reminder" },
  { key: "customer_statement", label: "Customer statement" },
];

function CollectionsSettingsPage() {
  const finance = useFinancePermissions();
  const policy = useCollectionPolicy();
  const updatePolicy = useUpdateCollectionPolicy();
  const suppressions = useDeliverySuppressions();
  const upsertSuppression = useUpsertDeliverySuppression();
  const toggleSuppression = useToggleDeliverySuppression();

  const [draft, setDraft] = useState<{
    auto_reminders_enabled: boolean;
    auto_statements_enabled: boolean;
    friendly_before_due_days: string;
    overdue_after_due_days: string;
    final_after_due_days: string;
    statement_run_day: string;
    throttle_days: string;
    retry_delay_minutes: string;
    max_retry_attempts: string;
    batch_limit: string;
    sender_display_name: string;
    default_reply_to: string;
    invoice_template_key: DeliveryTemplateKey;
    friendly_template_key: DeliveryTemplateKey;
    overdue_template_key: DeliveryTemplateKey;
    final_template_key: DeliveryTemplateKey;
    statement_template_key: DeliveryTemplateKey;
  } | null>(null);
  const [suppressionEmail, setSuppressionEmail] = useState("");
  const [suppressionReason, setSuppressionReason] = useState("");

  useEffect(() => {
    if (!policy.data) return;
    setDraft({
      auto_reminders_enabled: policy.data.auto_reminders_enabled,
      auto_statements_enabled: policy.data.auto_statements_enabled,
      friendly_before_due_days: String(policy.data.friendly_before_due_days),
      overdue_after_due_days: String(policy.data.overdue_after_due_days),
      final_after_due_days: String(policy.data.final_after_due_days),
      statement_run_day: String(policy.data.statement_run_day),
      throttle_days: String(policy.data.throttle_days),
      retry_delay_minutes: String(policy.data.retry_delay_minutes),
      max_retry_attempts: String(policy.data.max_retry_attempts),
      batch_limit: String(policy.data.batch_limit),
      sender_display_name: policy.data.sender_display_name ?? "",
      default_reply_to: policy.data.default_reply_to ?? "",
      invoice_template_key: policy.data.invoice_template_key,
      friendly_template_key: policy.data.friendly_template_key,
      overdue_template_key: policy.data.overdue_template_key,
      final_template_key: policy.data.final_template_key,
      statement_template_key: policy.data.statement_template_key,
    });
  }, [policy.data]);

  const policySummary = useMemo(() => {
    if (!policy.data) return "Loading policy…";
    return [
      policy.data.auto_reminders_enabled ? "automated reminders on" : "manual reminders",
      policy.data.auto_statements_enabled
        ? `statements day ${policy.data.statement_run_day}`
        : "statements off",
      `retry ${policy.data.max_retry_attempts}x`,
    ].join(" · ");
  }, [policy.data]);

  async function savePolicy() {
    if (!draft) return;
    try {
      await updatePolicy.mutateAsync({
        auto_reminders_enabled: draft.auto_reminders_enabled,
        auto_statements_enabled: draft.auto_statements_enabled,
        friendly_before_due_days: Number(draft.friendly_before_due_days || 0),
        overdue_after_due_days: Number(draft.overdue_after_due_days || 0),
        final_after_due_days: Number(draft.final_after_due_days || 0),
        statement_run_day: Number(draft.statement_run_day || 1),
        throttle_days: Number(draft.throttle_days || 0),
        retry_delay_minutes: Number(draft.retry_delay_minutes || 30),
        max_retry_attempts: Number(draft.max_retry_attempts || 0),
        batch_limit: Number(draft.batch_limit || 100),
        sender_display_name: draft.sender_display_name.trim() || null,
        default_reply_to: draft.default_reply_to.trim() || null,
        invoice_template_key: draft.invoice_template_key,
        friendly_template_key: draft.friendly_template_key,
        overdue_template_key: draft.overdue_template_key,
        final_template_key: draft.final_template_key,
        statement_template_key: draft.statement_template_key,
      });
      toast.success("Collections policy saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save collections policy");
    }
  }

  async function addSuppression() {
    try {
      await upsertSuppression.mutateAsync({
        email: suppressionEmail,
        reason: suppressionReason || null,
        isActive: true,
      });
      setSuppressionEmail("");
      setSuppressionReason("");
      toast.success("Suppression saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save suppression");
    }
  }

  if (!draft) {
    return <div className="py-8 text-sm text-muted-foreground">Loading collections settings…</div>;
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>Collections automation</AlertTitle>
        <AlertDescription>
          Scheduled reminders and statement runs use the cron-protected routes at{" "}
          <code>/api/communications/run-scheduled</code> and{" "}
          <code>/api/communications/process-queue</code>. Resend delivery events are enriched via{" "}
          <code>/api/communications/webhooks/resend</code>.
        </AlertDescription>
      </Alert>

      {!finance.canManageCollections && (
        <Alert>
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            You can review the current policy, but only finance roles can manage collections and
            suppression behavior.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reminder cadence</CardTitle>
          <p className="text-xs text-muted-foreground">{policySummary}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ToggleField
              label="Automated reminders"
              description="Run friendly / overdue / final reminders from the scheduler."
              checked={draft.auto_reminders_enabled}
              disabled={!finance.canManageCollectionPolicies}
              onCheckedChange={(checked) =>
                setDraft((current) => (current ? { ...current, auto_reminders_enabled: checked } : current))
              }
            />
            <ToggleField
              label="Automated statements"
              description="Send customer statements on the configured statement day."
              checked={draft.auto_statements_enabled}
              disabled={!finance.canManageCollectionPolicies}
              onCheckedChange={(checked) =>
                setDraft((current) => (current ? { ...current, auto_statements_enabled: checked } : current))
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <NumberField
              label="Friendly before due (days)"
              value={draft.friendly_before_due_days}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, friendly_before_due_days: value } : current))
              }
            />
            <NumberField
              label="Overdue after due (days)"
              value={draft.overdue_after_due_days}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, overdue_after_due_days: value } : current))
              }
            />
            <NumberField
              label="Final reminder after due (days)"
              value={draft.final_after_due_days}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, final_after_due_days: value } : current))
              }
            />
            <NumberField
              label="Statement day"
              value={draft.statement_run_day}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, statement_run_day: value } : current))
              }
            />
            <NumberField
              label="Throttle days"
              value={draft.throttle_days}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, throttle_days: value } : current))
              }
            />
            <NumberField
              label="Batch limit"
              value={draft.batch_limit}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, batch_limit: value } : current))
              }
            />
            <NumberField
              label="Retry delay (minutes)"
              value={draft.retry_delay_minutes}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, retry_delay_minutes: value } : current))
              }
            />
            <NumberField
              label="Max retry attempts"
              value={draft.max_retry_attempts}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, max_retry_attempts: value } : current))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sender defaults and template mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Sender display name"
              value={draft.sender_display_name}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, sender_display_name: value } : current))
              }
            />
            <TextField
              label="Default reply-to"
              value={draft.default_reply_to}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, default_reply_to: value } : current))
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TemplateField
              label="Invoice template"
              value={draft.invoice_template_key}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, invoice_template_key: value } : current))
              }
            />
            <TemplateField
              label="Friendly reminder template"
              value={draft.friendly_template_key}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, friendly_template_key: value } : current))
              }
            />
            <TemplateField
              label="Overdue reminder template"
              value={draft.overdue_template_key}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, overdue_template_key: value } : current))
              }
            />
            <TemplateField
              label="Final reminder template"
              value={draft.final_template_key}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, final_template_key: value } : current))
              }
            />
            <TemplateField
              label="Statement template"
              value={draft.statement_template_key}
              disabled={!finance.canManageCollectionPolicies}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, statement_template_key: value } : current))
              }
            />
          </div>

          {finance.canManageCollectionPolicies && (
            <div className="flex justify-end">
              <Button onClick={() => void savePolicy()} disabled={updatePolicy.isPending}>
                {updatePolicy.isPending ? "Saving…" : "Save collections policy"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suppressions and opt-out handling</CardTitle>
          <p className="text-xs text-muted-foreground">
            Suppressed recipients are skipped in manual, batch, and automated send flows.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto]">
            <TextField
              label="Recipient email"
              value={suppressionEmail}
              disabled={!finance.canManageDeliverySuppressions}
              onChange={setSuppressionEmail}
            />
            <TextField
              label="Reason"
              value={suppressionReason}
              disabled={!finance.canManageDeliverySuppressions}
              onChange={setSuppressionReason}
            />
            <div className="flex items-end">
              <Button
                onClick={() => void addSuppression()}
                disabled={
                  !finance.canManageDeliverySuppressions ||
                  upsertSuppression.isPending ||
                  suppressionEmail.trim().length === 0
                }
              >
                Add suppression
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Recipient</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-right">Active</th>
                </tr>
              </thead>
              <tbody>
                {(suppressions.data?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No suppressions configured.
                    </td>
                  </tr>
                )}
                {suppressions.data?.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{item.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.reason ?? "—"}</td>
                    <td className="px-3 py-2 capitalize">{item.source}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Switch
                        checked={item.is_active}
                        disabled={!finance.canManageDeliverySuppressions || toggleSuppression.isPending}
                        onCheckedChange={(checked) =>
                          void toggleSuppression.mutateAsync({ id: item.id, isActive: checked })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div>
        <div className="font-medium">{label}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function NumberField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        min="0"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1"
      />
    </div>
  );
}

function TemplateField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: DeliveryTemplateKey;
  disabled: boolean;
  onChange: (value: DeliveryTemplateKey) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as DeliveryTemplateKey)}>
        <SelectTrigger className="mt-1" disabled={disabled}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {templateOptions.map((option) => (
            <SelectItem key={option.key} value={option.key}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
