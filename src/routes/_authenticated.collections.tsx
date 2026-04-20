import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CircleX,
  MailCheck,
  RefreshCcw,
  SendHorizonal,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/data/PageHeader";
import { MetricCard } from "@/components/data/MetricCard";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { StatusBadge } from "@/components/data/StatusBadge";
import { CollectionsBatchDialog } from "@/components/delivery/CollectionsBatchDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCollectionPolicy,
  useCollectionsDashboard,
  usePreviewCollectionsBatch,
  useSendCollectionsBatch,
  type BatchPreviewResult,
} from "@/features/delivery/collections";
import { useRetryDocumentDelivery } from "@/features/delivery/hooks";
import { useFinancePermissions } from "@/features/accounting/permissions";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/collections")({
  component: CollectionsPage,
});

type StageFilter = "all" | "friendly" | "overdue" | "final";
type BatchKind = "reminders" | "statements";

function CollectionsPage() {
  const { company } = useAuth();
  const finance = useFinancePermissions();
  const currency = company?.currency ?? "USD";
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKind, setDialogKind] = useState<BatchKind>("reminders");
  const [previewResult, setPreviewResult] = useState<BatchPreviewResult | null>(null);

  const policy = useCollectionPolicy();
  const dashboard = useCollectionsDashboard({
    search: deferredSearch || undefined,
    stage: stageFilter === "all" ? undefined : stageFilter,
  });
  const preview = usePreviewCollectionsBatch();
  const sendBatch = useSendCollectionsBatch();
  const retry = useRetryDocumentDelivery();

  const automationSummary = useMemo(() => {
    if (!policy.data) return "Loading cadence…";
    if (!policy.data.auto_reminders_enabled && !policy.data.auto_statements_enabled) {
      return "Automation disabled";
    }
    const parts: string[] = [];
    if (policy.data.auto_reminders_enabled) {
      parts.push(`reminders on · throttle ${policy.data.throttle_days}d`);
    }
    if (policy.data.auto_statements_enabled) {
      parts.push(`statements day ${policy.data.statement_run_day}`);
    }
    return parts.join(" · ");
  }, [policy.data]);

  async function openBatch(kind: BatchKind) {
    try {
      const result = await preview.mutateAsync({
        kind,
        search: deferredSearch || null,
        readyOnly: kind === "reminders",
        stageOverride: kind === "reminders" && stageFilter !== "all" ? stageFilter : null,
      });
      setDialogKind(kind);
      setPreviewResult(result);
      setDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to preview batch");
    }
  }

  async function confirmBatch() {
    try {
      const result = await sendBatch.mutateAsync({
        kind: dialogKind,
        search: deferredSearch || null,
        readyOnly: dialogKind === "reminders",
        stageOverride: dialogKind === "reminders" && stageFilter !== "all" ? stageFilter : null,
      });
      toast.success(
        `${result.sent} sent · ${result.failed} failed · ${result.suppressed} suppressed`,
      );
      setDialogOpen(false);
      setPreviewResult(result.preview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send batch");
    }
  }

  async function retryFailed(deliveryId: string) {
    const companyId = company?.id;
    if (!companyId) return;
    try {
      await retry.mutateAsync({ companyId, deliveryId });
      toast.success("Delivery retried");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry delivery");
    }
  }

  if (!finance.canManageCollections) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Collections"
          description="Overdue follow-up, batch reminders, and failed-delivery diagnostics."
        />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Finance access required</AlertTitle>
          <AlertDescription>
            Owner, accountant, or sales manager roles are required to access collections
            automation and overdue communication workflows.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        description="Run overdue follow-up, inspect communication failures, and keep customer balances moving without losing ledger traceability."
        actions={
          <>
            <Button variant="outline" onClick={() => void openBatch("statements")}>
              Preview statements
            </Button>
            <Button onClick={() => void openBatch("reminders")}>
              <SendHorizonal className="mr-2 h-4 w-4" />
              Preview reminders
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total overdue"
          value={<MoneyDisplay value={dashboard.data?.totalOverdueAmount ?? 0} currency={currency} />}
          hint="Invoices past due date"
          icon={<BellRing className="h-5 w-5" />}
          accent="danger"
        />
        <MetricCard
          label="Ready now"
          value={dashboard.data?.readyNowCount ?? 0}
          hint={
            <MoneyDisplay value={dashboard.data?.readyNowAmount ?? 0} currency={currency} />
          }
          icon={<MailCheck className="h-5 w-5" />}
          accent="warning"
        />
        <MetricCard
          label="Failed deliveries"
          value={dashboard.data?.failedDeliveries ?? 0}
          hint="Retryable send failures / bounces"
          icon={<CircleX className="h-5 w-5" />}
          accent={(dashboard.data?.failedDeliveries ?? 0) > 0 ? "danger" : "success"}
        />
        <MetricCard
          label="Automation policy"
          value={policy.data?.auto_reminders_enabled ? "Live" : "Manual"}
          hint={automationSummary}
          icon={<RefreshCcw className="h-5 w-5" />}
          accent={policy.data?.auto_reminders_enabled ? "success" : "info"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(dashboard.data?.aging ?? []).map((bucket) => (
          <MetricCard
            key={bucket.key}
            label={bucket.label}
            value={<MoneyDisplay value={bucket.amount} currency={currency} />}
            hint={`${bucket.count} invoices`}
            accent={bucket.key === "current" ? "info" : bucket.key === "61+" ? "danger" : "warning"}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Work queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),220px]">
            <div>
              <Label htmlFor="collections-search">Customer or invoice</Label>
              <Input
                id="collections-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customer, recipient, or invoice number"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="collections-stage">Reminder stage</Label>
              <Select value={stageFilter} onValueChange={(value) => setStageFilter(value as StageFilter)}>
                <SelectTrigger id="collections-stage" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer / recipient</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Due / aging</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Last contact</TableHead>
                  <TableHead>Next action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Loading collections queue…
                    </TableCell>
                  </TableRow>
                )}
                {!dashboard.isLoading && (dashboard.data?.items.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No matching overdue items. Adjust filters or wait for the next due invoice.
                    </TableCell>
                  </TableRow>
                )}
                {dashboard.data?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.customerName}</div>
                      <div className="text-xs text-muted-foreground">{item.recipient ?? "No email on file"}</div>
                    </TableCell>
                    <TableCell>
                      <a href={item.sourceHref} className="font-mono text-xs underline-offset-4 hover:underline">
                        {item.documentNumber}
                      </a>
                      <div className="text-xs text-muted-foreground">{formatDate(item.issueDate)}</div>
                    </TableCell>
                    <TableCell>
                      <div>{item.dueDate ? formatDate(item.dueDate) : "No due date"}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.daysOverdue > 0
                          ? `${item.daysOverdue} days overdue · ${item.agingBucket}`
                          : item.daysOverdue === 0
                            ? "Due today"
                            : `${Math.abs(item.daysOverdue)} days until due`}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(item.balanceDue, currency)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {item.lastContactAt ? formatDateTime(item.lastContactAt) : "No contact yet"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.lastContactSummary ?? "Awaiting first touch"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {item.readyNow
                          ? `Ready: ${item.targetStage ?? "reminder"}`
                          : item.sendable
                            ? item.nextActionAt
                              ? `Next eligible ${formatDate(item.nextActionAt)}`
                              : "Eligible"
                            : "Blocked"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.skipReason ?? item.targetTemplateKey ?? "Uses policy cadence"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Failed delivery diagnostics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Diagnostics</TableHead>
                  <TableHead>Next retry</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dashboard.data?.failedQueue.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No failed deliveries right now.
                    </TableCell>
                  </TableRow>
                )}
                {dashboard.data?.failedQueue.map((item) => (
                  <TableRow key={item.deliveryId}>
                    <TableCell>
                      {item.sourceHref ? (
                        <a href={item.sourceHref} className="font-mono text-xs underline-offset-4 hover:underline">
                          {item.documentNumber}
                        </a>
                      ) : (
                        <span className="font-mono text-xs">{item.documentNumber}</span>
                      )}
                    </TableCell>
                    <TableCell>{item.recipient ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{item.lastEventSummary ?? item.error ?? "Delivery failed"}</div>
                      {item.error && (
                        <div className="mt-1 text-xs text-destructive">{item.error}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.nextRetryAt ? formatDateTime(item.nextRetryAt) : "Manual retry"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void retryFailed(item.deliveryId)}
                        disabled={retry.isPending}
                      >
                        Retry now
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CollectionsBatchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogKind === "reminders" ? "Preview reminder batch" : "Preview statement batch"}
        description={
          dialogKind === "reminders"
            ? "This preview uses the live overdue queue, suppression list, and reminder cadence before any messages are queued."
            : "Statements are only queued for customers with a valid recipient and an open balance."
        }
        preview={previewResult}
        confirmLabel={dialogKind === "reminders" ? "Queue reminders" : "Queue statements"}
        currency={currency}
        loading={sendBatch.isPending || preview.isPending}
        onConfirm={confirmBatch}
      />
    </div>
  );
}
