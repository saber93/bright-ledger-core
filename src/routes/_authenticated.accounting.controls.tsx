import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookLock,
  CheckCircle2,
  Clock3,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/data/PageHeader";
import { MetricCard } from "@/components/data/MetricCard";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAccountingPeriods,
  useCloseAccountingPeriod,
  useCloseChecklist,
  useFinanceAudit,
  useFinanceExceptions,
  useReopenAccountingPeriod,
} from "@/features/accounting/controls";
import { FinanceReasonDialog } from "@/components/accounting/FinanceReasonDialog";
import { useFinancePermissions } from "@/features/accounting/permissions";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/accounting/controls")({
  component: AccountingControlsPage,
});

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function AccountingControlsPage() {
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";
  const finance = useFinancePermissions();
  const periods = useAccountingPeriods(18, 1);
  const exceptions = useFinanceExceptions();
  const audit = useFinanceAudit(60);
  const closePeriod = useCloseAccountingPeriod();
  const reopenPeriod = useReopenAccountingPeriod();

  const [selectedPeriodStart, setSelectedPeriodStart] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [closeTarget, setCloseTarget] = useState<string | null>(null);
  const [reopenTarget, setReopenTarget] = useState<string | null>(null);

  useEffect(() => {
    if (periods.data && periods.data.length > 0) {
      const exists = periods.data.some((period) => period.period_start === selectedPeriodStart);
      if (!exists) setSelectedPeriodStart(periods.data[0].period_start);
    }
  }, [periods.data, selectedPeriodStart]);

  const selectedPeriod = useMemo(
    () => periods.data?.find((period) => period.period_start === selectedPeriodStart) ?? null,
    [periods.data, selectedPeriodStart],
  );
  const checklist = useCloseChecklist(selectedPeriod?.period_end ?? today());

  if (!finance.canViewFinanceControls) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Accounting Controls"
          description="Period close, finance exceptions, and audit history."
          breadcrumbs={
            <Link to="/dashboard" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Dashboard
            </Link>
          }
        />
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Finance access required</AlertTitle>
          <AlertDescription>
            Only owner and accountant roles can view accounting controls, period close actions, and
            finance exceptions.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const unresolvedExceptions = exceptions.data?.length ?? 0;
  const closedPeriods = (periods.data ?? []).filter((period) => period.status === "closed").length;
  const currentPeriodClosed = selectedPeriod?.status === "closed";

  return (
    <div>
      <PageHeader
        title="Accounting Controls"
        description="Protect the books with controlled period close, visible exceptions, and an auditable finance workflow."
        breadcrumbs={
          <Link to="/dashboard" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/reports/trial-balance">Trial Balance</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/reports/balance-sheet">Balance Sheet</Link>
            </Button>
            {selectedPeriod && selectedPeriod.status === "open" && finance.canClosePeriods && (
              <Button onClick={() => setCloseTarget(selectedPeriod.period_start)}>
                Close {selectedPeriod.label}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Selected Period"
          value={selectedPeriod?.label ?? "—"}
          hint={selectedPeriod ? `${formatDate(selectedPeriod.period_start)} – ${formatDate(selectedPeriod.period_end)}` : undefined}
          icon={<BookLock className="h-5 w-5" />}
          accent={currentPeriodClosed ? "warning" : "primary"}
        />
        <MetricCard
          label="Closed Periods"
          value={closedPeriods}
          hint="Periods explicitly locked through Accounting Controls"
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="info"
        />
        <MetricCard
          label="Finance Exceptions"
          value={unresolvedExceptions}
          hint={unresolvedExceptions === 0 ? "No unresolved warnings" : "Needs finance review"}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={unresolvedExceptions === 0 ? "success" : "danger"}
        />
        <MetricCard
          label="Recent Audit Events"
          value={audit.data?.length ?? 0}
          hint="Latest finance-sensitive actions"
          icon={<Clock3 className="h-5 w-5" />}
          accent="warning"
        />
      </div>

      {currentPeriodClosed ? (
        <Alert className="mt-4">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{selectedPeriod?.label} is closed</AlertTitle>
          <AlertDescription>
            {selectedPeriod?.close_reason
              ? selectedPeriod.close_reason
              : "Posting into this period is blocked until it is reopened by an authorized user."}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{selectedPeriod?.label ?? "Current period"} is open</AlertTitle>
          <AlertDescription>
            Use the checklist below before closing the books. Reopening is owner-only and fully
            audited.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Open Receivables"
              value={
                <MoneyDisplay
                  value={checklist.data?.receivables.amount ?? 0}
                  currency={currency}
                />
              }
              hint={`${checklist.data?.receivables.count ?? 0} open invoices`}
              accent="info"
            />
            <MetricCard
              label="Open Payables"
              value={
                <MoneyDisplay value={checklist.data?.payables.amount ?? 0} currency={currency} />
              }
              hint={`${checklist.data?.payables.count ?? 0} open bills`}
              accent="danger"
            />
            <MetricCard
              label="Open Cash Sessions"
              value={checklist.data?.open_cash_sessions.count ?? 0}
              hint={
                <MoneyDisplay
                  value={checklist.data?.open_cash_sessions.expected_cash ?? 0}
                  currency={currency}
                />
              }
              accent="warning"
            />
            <MetricCard
              label="Refunds / Credits in Period"
              value={checklist.data?.recent_credits.count ?? 0}
              hint={
                <MoneyDisplay
                  value={checklist.data?.recent_credits.total ?? 0}
                  currency={currency}
                />
              }
              accent="primary"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Close checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ChecklistRow
                  label="Open receivables reviewed"
                  detail={`${checklist.data?.receivables.count ?? 0} invoices still open`}
                  done={(checklist.data?.receivables.count ?? 0) === 0}
                />
                <ChecklistRow
                  label="Open payables reviewed"
                  detail={`${checklist.data?.payables.count ?? 0} supplier bills still open`}
                  done={(checklist.data?.payables.count ?? 0) === 0}
                />
                <ChecklistRow
                  label="Cash sessions closed"
                  detail={`${checklist.data?.open_cash_sessions.count ?? 0} sessions still open`}
                  done={(checklist.data?.open_cash_sessions.count ?? 0) === 0}
                />
                <ChecklistRow
                  label="Refunds and credits reviewed"
                  detail={`${checklist.data?.recent_credits.count ?? 0} refund/credit documents in period`}
                  done={(checklist.data?.recent_credits.count ?? 0) === 0}
                />
                <ChecklistRow
                  label="Finance exceptions resolved"
                  detail={`${checklist.data?.exceptions.count ?? 0} unresolved warnings`}
                  done={(checklist.data?.exceptions.count ?? 0) === 0}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent refunds / credits</CardTitle>
              </CardHeader>
              <CardContent>
                {(checklist.data?.recent_credits.items.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No refund or credit-note activity in the selected period.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {checklist.data?.recent_credits.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <div>
                          <div className="font-medium">{item.credit_note_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(item.issue_date)}
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={item.status} />
                          <div className="mt-1 font-mono">
                            <MoneyDisplay value={item.total} currency={currency} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="periods" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accounting periods</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Closed / reopened</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.data?.map((period) => (
                    <TableRow
                      key={period.period_start}
                      className={period.period_start === selectedPeriodStart ? "bg-muted/20" : undefined}
                    >
                      <TableCell>
                        <button
                          className="text-left hover:text-foreground"
                          onClick={() => setSelectedPeriodStart(period.period_start)}
                        >
                          <div className="font-medium">{period.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(period.period_start)} – {formatDate(period.period_end)}
                          </div>
                        </button>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={period.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {period.status === "closed"
                          ? period.close_reason ?? "Closed without a note"
                          : period.reopen_reason ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {period.closed_at && <div>Closed {formatDateTime(period.closed_at)}</div>}
                        {period.reopened_at && <div>Reopened {formatDateTime(period.reopened_at)}</div>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {period.status === "open" && finance.canClosePeriods && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setCloseTarget(period.period_start)}
                            >
                              Close
                            </Button>
                          )}
                          {period.status === "closed" && finance.canReopenPeriods && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReopenTarget(period.period_start)}
                            >
                              Reopen
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Finance exceptions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(exceptions.data?.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No finance exceptions detected.
                      </TableCell>
                    </TableRow>
                  )}
                  {exceptions.data?.map((warning) => (
                    <TableRow key={`${warning.kind}-${warning.source_id}`}>
                      <TableCell>
                        <span
                          className={
                            warning.severity === "danger"
                              ? "font-medium text-destructive"
                              : "font-medium text-warning-foreground"
                          }
                        >
                          {warning.severity}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize">
                        {warning.kind.replaceAll("_", " ")}
                      </TableCell>
                      <TableCell>
                        <div>{warning.document_number ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {warning.journal_date ? formatDate(warning.journal_date) : warning.source_type}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {warning.message}
                      </TableCell>
                      <TableCell className="text-right">
                        {warning.source_href ? (
                          <a
                            href={warning.source_href}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            Open
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Finance audit trail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Who</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(audit.data?.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No finance audit events yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {audit.data?.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(entry.created_at)}
                      </TableCell>
                      <TableCell>{entry.actor_name ?? entry.actor_id ?? "System"}</TableCell>
                      <TableCell className="capitalize">
                        {entry.action.replaceAll("_", " ")}
                      </TableCell>
                      <TableCell>{entry.summary ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.entity_number ?? entry.entity_type ?? entry.table_name}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FinanceReasonDialog
        open={!!closeTarget}
        onOpenChange={(open) => {
          if (!open) setCloseTarget(null);
        }}
        title="Close accounting period"
        description="Closing a period blocks new postings and destructive edits inside that month until the period is reopened."
        confirmLabel="Close period"
        pendingLabel="Closing…"
        onConfirm={async (reason) => {
          if (!closeTarget) return;
          try {
            await closePeriod.mutateAsync({ periodStart: closeTarget, reason });
            toast.success("Accounting period closed");
            setCloseTarget(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to close period");
            throw error;
          }
        }}
      />

      <FinanceReasonDialog
        open={!!reopenTarget}
        onOpenChange={(open) => {
          if (!open) setReopenTarget(null);
        }}
        title="Reopen accounting period"
        description="Reopening a period should be rare. This action is owner-only and will be recorded in the finance audit trail."
        confirmLabel="Reopen period"
        pendingLabel="Reopening…"
        onConfirm={async (reason) => {
          if (!reopenTarget) return;
          try {
            await reopenPeriod.mutateAsync({ periodStart: reopenTarget, reason });
            toast.success("Accounting period reopened");
            setReopenTarget(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to reopen period");
            throw error;
          }
        }}
      />
    </div>
  );
}

function ChecklistRow({
  label,
  detail,
  done,
}: {
  label: string;
  detail: string;
  done: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <span className={done ? "text-success" : "text-warning-foreground"}>
        {done ? "Resolved" : "Review"}
      </span>
    </div>
  );
}
