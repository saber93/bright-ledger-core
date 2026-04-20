import type { ReactNode } from "react";
import { Mail, RotateCcw, SendHorizonal, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/StatusBadge";
import {
  useDocumentDeliveries,
  useRetryDocumentDelivery,
  type DocumentDelivery,
  type DocumentType,
} from "@/features/delivery/hooks";
import { useFinancePermissions } from "@/features/accounting/permissions";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

function labelForEvent(delivery: DocumentDelivery) {
  if (delivery.event_type === "statement") return "Statement";
  if (delivery.template_key === "reminder_friendly") return "Friendly reminder";
  if (delivery.template_key === "reminder_overdue") return "Overdue reminder";
  if (delivery.template_key === "reminder_final") return "Final reminder";
  return "Document email";
}

export function DocumentCommunicationCard({
  documentType,
  documentId,
  title = "Communication",
  emptyText = "No document emails or reminders have been sent yet.",
  actions,
  onResend,
  allowRetryNow = true,
}: {
  documentType: DocumentType;
  documentId: string;
  title?: string;
  emptyText?: string;
  actions?: ReactNode;
  onResend?: (delivery: DocumentDelivery) => void;
  allowRetryNow?: boolean;
}) {
  const { companyId } = useAuth();
  const finance = useFinancePermissions();
  const deliveries = useDocumentDeliveries(documentType, documentId);
  const retry = useRetryDocumentDelivery();
  const latest = deliveries.data?.[0] ?? null;

  async function retryNow(delivery: DocumentDelivery) {
    if (!companyId) return;
    try {
      await retry.mutateAsync({
        companyId,
        deliveryId: delivery.id,
      });
      toast.success("Delivery retried");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry delivery");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Delivery tracking, reminder history, and resend controls.
          </p>
        </div>
        {actions}
      </CardHeader>
      <CardContent className="space-y-4">
        {latest ? (
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={latest.status} />
                  <span className="text-sm font-medium">{labelForEvent(latest)}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {latest.recipient ?? "—"} · {formatDateTime(latest.sent_at)}
                </div>
                {latest.last_event_summary && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {latest.last_event_summary}
                  </div>
                )}
              </div>
              {latest.status === "failed" && (
                <div className="inline-flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Needs attention
                </div>
              )}
            </div>
            {latest.error && (
              <div className="mt-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {latest.error}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Mail className="mx-auto mb-2 h-5 w-5 text-muted-foreground/70" />
            {emptyText}
          </div>
        )}

        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Recipient</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Sent</th>
                <th className="px-3 py-2 text-left">Diagnostics</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.isLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Loading communication history…
                  </td>
                </tr>
              )}
              {!deliveries.isLoading && (deliveries.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No communication history yet.
                  </td>
                </tr>
              )}
              {deliveries.data?.map((delivery) => (
                <tr key={delivery.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{labelForEvent(delivery)}</div>
                    <div className="text-xs text-muted-foreground">{delivery.channel}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{delivery.recipient_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{delivery.recipient ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={delivery.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDateTime(delivery.sent_at)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="line-clamp-2">{delivery.subject ?? "—"}</div>
                    {delivery.last_event_summary && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {delivery.last_event_summary}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      Attempt {delivery.attempt_count || 0}
                      {delivery.last_attempt_at
                        ? ` · last try ${formatDateTime(delivery.last_attempt_at)}`
                        : ""}
                      {delivery.next_retry_at
                        ? ` · next retry ${formatDateTime(delivery.next_retry_at)}`
                        : ""}
                    </div>
                    {(delivery.delivered_at || delivery.opened_at || delivery.clicked_at) && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {delivery.delivered_at ? `Delivered ${formatDateTime(delivery.delivered_at)}` : ""}
                        {delivery.opened_at ? ` · Opened ${formatDateTime(delivery.opened_at)}` : ""}
                        {delivery.clicked_at ? ` · Clicked ${formatDateTime(delivery.clicked_at)}` : ""}
                      </div>
                    )}
                    {delivery.error && (
                      <div className="mt-1 text-xs text-destructive">{delivery.error}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {allowRetryNow &&
                        finance.canRetryDeliveryFailures &&
                        (delivery.status === "failed" ||
                          delivery.status === "rejected" ||
                          delivery.status === "bounced" ||
                          delivery.status === "complained") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void retryNow(delivery)}
                            disabled={retry.isPending}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry now
                          </Button>
                        )}
                      {onResend && (
                        <Button size="sm" variant="ghost" onClick={() => onResend(delivery)}>
                          <>
                            <SendHorizonal className="mr-1 h-3.5 w-3.5" /> Resend
                          </>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
