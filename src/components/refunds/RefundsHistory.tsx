import { Link } from "@tanstack/react-router";
import { useRefundsForInvoice, useRefundsForPosOrder } from "@/features/refunds/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { formatDate } from "@/lib/format";
import { ChevronRight, Undo2 } from "lucide-react";

interface Props {
  source: "invoice" | "pos";
  sourceId: string;
  currency?: string;
}

export function RefundsHistory({ source, sourceId, currency = "USD" }: Props) {
  const invoiceQ = useRefundsForInvoice(source === "invoice" ? sourceId : undefined);
  const posQ = useRefundsForPosOrder(source === "pos" ? sourceId : undefined);
  const refunds = (source === "invoice" ? invoiceQ.data : posQ.data) ?? [];
  const isLoading = source === "invoice" ? invoiceQ.isLoading : posQ.isLoading;

  const totalRefunded = refunds.reduce((s, r) => s + Number(r.total ?? 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Undo2 className="h-4 w-4 text-muted-foreground" />
          Refunds & credit notes
          {refunds.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {refunds.length}
            </Badge>
          )}
        </CardTitle>
        {refunds.length > 0 && (
          <div className="text-right text-xs text-muted-foreground">
            <div>Total refunded</div>
            <MoneyDisplay value={totalRefunded} currency={currency} className="text-sm font-semibold text-foreground" />
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="py-2 text-xs text-muted-foreground">Loading…</p>
        ) : refunds.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">No refunds yet.</p>
        ) : (
          <ul className="divide-y">
            {refunds.map((r) => (
              <li key={r.id}>
                <Link
                  to="/refunds/$creditNoteId"
                  params={{ creditNoteId: r.id }}
                  className="group flex items-center justify-between gap-3 py-2 text-sm hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium">{r.credit_note_number}</span>
                      <Badge
                        variant={r.status === "void" ? "outline" : "secondary"}
                        className="capitalize"
                      >
                        {String(r.status).replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(r.issue_date)}
                    </div>
                  </div>
                  <MoneyDisplay value={r.total} currency={currency} className="font-medium" />
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
