import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { Banknote, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { openDocument } from "@/lib/open-document";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCompanySettings } from "@/features/settings/hooks";
import { useBranches, useRegisters } from "@/features/branches/hooks";
import {
  useCashSessions,
  useOpenCashSession,
  useOpenSessionMutation,
  useCloseSessionMutation,
  useCashEventMutation,
  useCashSessionDetail,
} from "@/features/pos/hooks";
import { usePostingAudit } from "@/features/accounting/ledger";
import { PostingAuditCard } from "@/components/accounting/PostingAuditCard";
import { useAuth } from "@/lib/auth";
import { formatDateTime, formatMoney } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cash-sessions")({
  validateSearch: (search: Record<string, unknown>) => ({
    sessionId: typeof search.sessionId === "string" ? search.sessionId : undefined,
  }),
  component: CashSessionsPage,
});

function CashSessionsPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const { data: settings } = useCompanySettings();
  const { data: branches = [] } = useBranches();
  const { data: registers = [] } = useRegisters();
  const { data: sessions = [] } = useCashSessions(50);
  const { company } = useAuth();

  const [registerId, setRegisterId] = useState<string | undefined>();
  useEffect(() => {
    if (!registerId && registers.length > 0) setRegisterId(registers[0].id);
  }, [registers, registerId]);

  const { data: openSession } = useOpenCashSession(registerId);
  const openMut = useOpenSessionMutation();
  const closeMut = useCloseSessionMutation();
  const eventMut = useCashEventMutation();

  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [eventDialog, setEventDialog] = useState<null | "cash_in" | "cash_out" | "payout">(
    null,
  );

  const [openCash, setOpenCash] = useState(0);
  const [openNotes, setOpenNotes] = useState("");
  const [counted, setCounted] = useState(0);
  const [closeNotes, setCloseNotes] = useState("");
  const [eventAmount, setEventAmount] = useState(0);
  const [eventNote, setEventNote] = useState("");

  const selectedSessionId = search.sessionId ?? openSession?.id ?? sessions[0]?.id;
  const { data: detail } = useCashSessionDetail(selectedSessionId);
  const viewedSession =
    detail?.session ??
    sessions.find((session) => session.id === selectedSessionId) ??
    openSession ??
    null;
  const sessionAudit = usePostingAudit({
    documentType: "cash_session",
    documentIds: viewedSession ? [viewedSession.id] : [],
  });

  if (settings && !settings.cash_sessions_enabled) {
    return (
      <div>
        <PageHeader title="Cash Sessions" description="Module disabled" />
        <EmptyState
          icon={<Banknote className="h-8 w-8" />}
          title="Cash sessions are disabled"
          description="Enable Cash Sessions in Settings → Modules & Features."
        />
      </div>
    );
  }

  if (registers.length === 0) {
    return (
      <div>
        <PageHeader title="Cash Sessions" description="Setup required" />
        <EmptyState
          icon={<Banknote className="h-8 w-8" />}
          title="No register configured"
          description="Add a branch and register in Settings → Branches & Registers."
        />
      </div>
    );
  }

  const currentRegister = registers.find((r) => r.id === registerId);
  const currency = company?.currency ?? "USD";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cash Sessions"
        description="Open and close register shifts with reconciliation."
        actions={
          openSession ? (
            <Button onClick={() => setCloseDialog(true)} variant="default">
              Close session
            </Button>
          ) : (
            <Button onClick={() => setOpenDialog(true)}>
              <Plus className="mr-1 h-4 w-4" /> Open session
            </Button>
          )
        }
      />

      <div className="flex items-center gap-2">
        <Label className="text-xs">Register</Label>
        <Select value={registerId} onValueChange={setRegisterId}>
          <SelectTrigger className="h-9 w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {registers.map((r) => {
              const b = branches.find((bb) => bb.id === r.branch_id);
              return (
                <SelectItem key={r.id} value={r.id}>
                  {b?.name ?? "—"} · {r.name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {viewedSession && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Session detail</CardTitle>
              <p className="text-xs text-muted-foreground">
                Opened {formatDateTime(viewedSession.opened_at)} ·{" "}
                {detail?.session?.pos_registers?.name ?? currentRegister?.name ?? "—"}
              </p>
            </div>
            <Badge variant={viewedSession.status === "open" ? "default" : "secondary"}>
              {viewedSession.status}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <Stat label="Opening cash" value={formatMoney(Number(viewedSession.opening_cash), currency)} />
              <Stat label="Expected cash" value={formatMoney(Number(viewedSession.expected_cash), currency)} />
              <Stat label="Events" value={String(detail?.events.length ?? 0)} />
            </div>

            {viewedSession.status === "open" && viewedSession.id === openSession?.id && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEventDialog("cash_in")}>
                  Cash in
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEventDialog("cash_out")}>
                  Cash out
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEventDialog("payout")}>
                  Payout
                </Button>
              </div>
            )}

            {detail && detail.events.length > 0 && (
              <div className="mt-4">
                <div className="text-xs uppercase text-muted-foreground">Activity</div>
                <div className="mt-2 divide-y rounded-md border">
                  {detail.events.map((e) => (
                    <div key={e.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium capitalize">{e.type.replace("_", " ")}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(e.created_at)}
                          {e.note && ` · ${e.note}`}
                          {e.reference && ` · ${e.reference}`}
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        {formatMoney(Number(e.amount), currency)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <PostingAuditCard
                audit={sessionAudit.data}
                currency={currency}
                isLoading={sessionAudit.isLoading}
                title="Ledger impact"
                description="Only cash-in, cash-out, and payout events create accounting journals. Opening, sale, refund, and closing markers stay operational."
                emptyDescription="This session has no transfer journals yet. That is normal until a cash-in, cash-out, or payout event is recorded."
                nonPostingNote="Cash sale and refund till events are deliberately excluded from accounting here because the ledger already posts them through payments and cash refunds."
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No sessions recorded yet.
            </div>
          ) : (
            <div className="divide-y">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    selectedSessionId === s.id ? "bg-muted/20" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {s.pos_registers?.name ?? "—"}
                      <Badge variant={s.status === "open" ? "default" : "secondary"}>
                        {s.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Opened {formatDateTime(s.opened_at)}
                      {s.closed_at && ` · Closed ${formatDateTime(s.closed_at)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <div>Expected {formatMoney(Number(s.expected_cash), currency)}</div>
                      {s.counted_cash !== null && (
                        <div className="text-muted-foreground">
                          Counted {formatMoney(Number(s.counted_cash), currency)}
                          {Number(s.variance) !== 0 && (
                            <span
                              className={
                                Number(s.variance) < 0 ? "text-destructive" : "text-emerald-500"
                              }
                            >
                              {" "}
                              ({Number(s.variance) > 0 ? "+" : ""}
                              {formatMoney(Number(s.variance), currency)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void navigate({
                          to: "/cash-sessions",
                          search: { sessionId: s.id },
                          replace: true,
                        })
                      }
                    >
                      Inspect
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void openDocument(`/api/documents/cash-session/${s.id}`)
                      }
                    >
                      Z-Report
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Open dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open cash session</DialogTitle>
            <DialogDescription>
              Count the opening float in the drawer for {currentRegister?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Opening cash</Label>
              <Input
                type="number"
                step="0.01"
                value={openCash}
                onChange={(e) => setOpenCash(Number(e.target.value || 0))}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDialog(false)} disabled={openMut.isPending}>
              Cancel
            </Button>
            <Button
              disabled={openMut.isPending}
              onClick={async () => {
                if (!registerId || !currentRegister) return;
                try {
                  await openMut.mutateAsync({
                    branch_id: currentRegister.branch_id,
                    register_id: registerId,
                    opening_cash: openCash,
                    notes: openNotes || null,
                  });
                  toast.success("Session opened");
                  setOpenDialog(false);
                  setOpenCash(0);
                  setOpenNotes("");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close dialog */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close cash session</DialogTitle>
            <DialogDescription>
              Expected {formatMoney(Number(openSession?.expected_cash ?? 0), currency)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Counted cash</Label>
              <Input
                type="number"
                step="0.01"
                value={counted}
                onChange={(e) => setCounted(Number(e.target.value || 0))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Variance:{" "}
                {formatMoney(counted - Number(openSession?.expected_cash ?? 0), currency)}
              </p>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseDialog(false)} disabled={closeMut.isPending}>
              Cancel
            </Button>
            <Button
              disabled={closeMut.isPending}
              onClick={async () => {
                if (!openSession) return;
                try {
                  await closeMut.mutateAsync({
                    session_id: openSession.id,
                    counted_cash: counted,
                    notes: closeNotes || null,
                  });
                  toast.success("Session closed");
                  setCloseDialog(false);
                  setCounted(0);
                  setCloseNotes("");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Close session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash event dialog */}
      <Dialog open={!!eventDialog} onOpenChange={(o) => !o && setEventDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {eventDialog?.replace("_", " ")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={eventAmount}
                onChange={(e) => setEventAmount(Number(e.target.value || 0))}
              />
            </div>
            <div>
              <Label>Note</Label>
              <Input value={eventNote} onChange={(e) => setEventNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEventDialog(null)} disabled={eventMut.isPending}>
              Cancel
            </Button>
            <Button
              disabled={eventMut.isPending}
              onClick={async () => {
                if (!openSession || !eventDialog) return;
                try {
                  await eventMut.mutateAsync({
                    session_id: openSession.id,
                    type: eventDialog,
                    amount: eventAmount,
                    note: eventNote || null,
                  });
                  toast.success("Recorded");
                  setEventDialog(null);
                  setEventAmount(0);
                  setEventNote("");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
