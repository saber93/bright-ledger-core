import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PostingAuditResult } from "@/features/accounting/ledger";

function labelForSourceType(sourceType: string) {
  switch (sourceType) {
    case "pos_invoice":
      return "POS revenue";
    case "customer_payment":
      return "Customer payment";
    case "supplier_payment":
      return "Supplier payment";
    case "pos_cogs":
      return "Inventory / COGS";
    case "credit_note":
      return "Credit note";
    case "credit_note_allocation":
      return "Credit allocation";
    case "cash_refund":
      return "Cash refund";
    case "refund_restock":
      return "Refund restock";
    case "cash_session_transfer":
      return "Cash transfer";
    default:
      return sourceType.replaceAll("_", " ");
  }
}

export function PostingAuditCard({
  audit,
  currency,
  title = "Posted ledger impact",
  description = "These are the actual posted journal lines used by the financial statements.",
  emptyTitle = "No posted ledger lines yet",
  emptyDescription = "This source has not produced posted ledger lines in the validated accounting view.",
  nonPostingNote,
  isLoading,
}: {
  audit?: PostingAuditResult;
  currency: string;
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  nonPostingNote?: string;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          {audit && audit.lines.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={audit.balanced ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}
              >
                {audit.balanced ? "Balanced" : "Imbalance"}
              </Badge>
              <Badge variant="outline">{audit.journals.length} journal{audit.journals.length === 1 ? "" : "s"}</Badge>
              {audit.fallbackLines.length > 0 && (
                <Badge variant="outline" className="border-warning/40 text-warning-foreground">
                  Fallback account used
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="py-6 text-sm text-muted-foreground">Loading posted ledger lines…</div>
        )}

        {!isLoading && (!audit || audit.lines.length === 0) && (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>{emptyTitle}</AlertTitle>
            <AlertDescription>
              <p>{emptyDescription}</p>
              {nonPostingNote && <p className="mt-2 text-xs text-muted-foreground">{nonPostingNote}</p>}
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && audit && audit.lines.length > 0 && (
          <>
            {!audit.balanced && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Ledger imbalance detected</AlertTitle>
                <AlertDescription>
                  Posted debits and credits differ by{" "}
                  <span className="font-semibold">
                    <MoneyDisplay value={audit.difference} currency={currency} />
                  </span>
                  . Treat this as an accounting validation problem until resolved.
                </AlertDescription>
              </Alert>
            )}

            {audit.balanced && audit.fallbackLines.length === 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Trace looks healthy</AlertTitle>
                <AlertDescription>
                  The posted journals for this source balance cleanly and do not rely on fallback lines.
                </AlertDescription>
              </Alert>
            )}

            {audit.fallbackLines.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Fallback account handling was used</AlertTitle>
                <AlertDescription>
                  At least one line used an adjustment/fallback path. The journals still post, but the source setup should be reviewed.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <AuditStat
                label="Total debits"
                value={<MoneyDisplay value={audit.totalDebit} currency={currency} />}
              />
              <AuditStat
                label="Total credits"
                value={<MoneyDisplay value={audit.totalCredit} currency={currency} />}
              />
              <AuditStat
                label="Difference"
                value={<MoneyDisplay value={audit.difference} currency={currency} />}
                tone={audit.balanced ? "muted" : "danger"}
              />
            </div>

            <div className="space-y-3">
              {audit.journals.map((journal) => (
                <div key={journal.journalKey} className="overflow-hidden rounded-lg border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/25 px-4 py-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{labelForSourceType(journal.sourceType)}</span>
                        <Badge variant="outline" className="capitalize">
                          {journal.paymentMethod ? journal.paymentMethod.replaceAll("_", " ") : "journal"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {journal.documentNumber || "—"} · {formatDate(journal.journalDate)}
                        {journal.postedAt && ` · posted ${formatDateTime(journal.postedAt)}`}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-medium">
                        <MoneyDisplay value={journal.debitTotal} currency={currency} />
                        {" / "}
                        <MoneyDisplay value={journal.creditTotal} currency={currency} />
                      </div>
                      <div className={journal.balanced ? "text-muted-foreground" : "text-destructive"}>
                        {journal.balanced ? "Balanced" : "Needs review"}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/15 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Account</th>
                          <th className="px-3 py-2 text-left font-medium">Description</th>
                          <th className="px-3 py-2 text-right font-medium">Debit</th>
                          <th className="px-3 py-2 text-right font-medium">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {journal.lines.map((line) => (
                          <tr key={line.line_key} className="border-t">
                            <td className="px-3 py-2">
                              <div className="font-mono text-xs text-muted-foreground">
                                {line.account_code ?? "—"}
                              </div>
                              <div>{line.account_name ?? "Unknown account"}</div>
                            </td>
                            <td className="px-3 py-2">
                              <div>{line.description}</div>
                              <div className="text-xs text-muted-foreground">
                                {line.counterparty_name ?? "—"}
                                {line.source_href && (
                                  <>
                                    {" · "}
                                    <a href={line.source_href} className="text-primary hover:underline">
                                      Source document
                                    </a>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {line.debit > 0 ? <MoneyDisplay value={line.debit} currency={currency} /> : "—"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {line.credit > 0 ? <MoneyDisplay value={line.credit} currency={currency} /> : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AuditStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "muted" | "danger";
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={
          tone === "danger"
            ? "mt-1 text-sm font-semibold text-destructive"
            : tone === "muted"
              ? "mt-1 text-sm font-semibold text-muted-foreground"
              : "mt-1 text-sm font-semibold"
        }
      >
        {value}
      </div>
    </div>
  );
}
