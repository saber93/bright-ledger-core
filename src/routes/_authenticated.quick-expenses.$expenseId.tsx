import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Receipt, Trash2, Pencil, FileText, Loader2, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/data/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import {
  useQuickExpense,
  getReceiptSignedUrl,
} from "@/features/quick-expenses/hooks";
import { useAuth } from "@/lib/auth";
import { openDocument } from "@/lib/open-document";
import { PostingAuditCard } from "@/components/accounting/PostingAuditCard";
import { usePostingAudit } from "@/features/accounting/ledger";
import { useAccountingPeriodState } from "@/features/accounting/controls";

export const Route = createFileRoute("/_authenticated/quick-expenses/$expenseId")({
  component: QuickExpenseDetailPage,
});

interface QuickExpenseDetail {
  id: string;
  expense_number: string;
  date: string;
  description: string;
  amount: number;
  tax_amount: number;
  currency: string;
  payment_method: string;
  paid: boolean;
  receipt_url: string | null;
  branch_id: string | null;
  created_at: string;
  account: { id: string; code: string; name: string; type: string } | null;
  payable: { id: string; code: string; name: string } | null;
  suppliers: { id: string; name: string } | null;
  branches: { id: string; name: string } | null;
  tax_rates: { id: string; name: string; rate: number } | null;
}

function QuickExpenseDetailPage() {
  const { expenseId } = Route.useParams();
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";
  const { data, isLoading } = useQuickExpense(expenseId);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const detail = data as QuickExpenseDetail | null;
  const periodState = useAccountingPeriodState(detail?.date);
  const postingAudit = usePostingAudit({
    documentType: "quick_expense",
    documentIds: detail ? [detail.id] : [],
  });

  useEffect(() => {
    let cancelled = false;
    if (detail?.receipt_url) {
      getReceiptSignedUrl(detail.receipt_url).then((u) => {
        if (!cancelled) setSignedUrl(u);
      });
    } else {
      setSignedUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [detail?.receipt_url]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Expense not found.</p>
        <Button asChild variant="link">
          <Link to="/quick-expenses">Back to expenses</Link>
        </Button>
      </div>
    );
  }

  const total = Number(detail.amount) + Number(detail.tax_amount ?? 0);
  const methodLabel: Record<string, string> = {
    cash: "Cash",
    bank: "Bank transfer",
    card: "Card",
    petty_cash: "Petty cash",
    unpaid: "Unpaid (on credit)",
    other: "Other",
  };

  const isImage = signedUrl && !/\.pdf(\?|$)/i.test(signedUrl);
  const isPdf = signedUrl && /\.pdf(\?|$)/i.test(signedUrl);
  const isLocked = !!periodState.data?.is_locked;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/quick-expenses">
            <ArrowLeft className="mr-1 h-4 w-4" /> Quick expenses
          </Link>
        </Button>
      </div>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{detail.expense_number}</span>
            {detail.paid ? (
              <Badge className="bg-success/15 text-success border-success/30">Paid</Badge>
            ) : (
              <Badge className="bg-warning/15 text-warning-foreground border-warning/40">
                Unpaid
              </Badge>
            )}
          </span>
        }
        description={`${detail.description} · ${formatDate(detail.date)}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void openDocument(`/api/documents/quick-expense/${expenseId}`)
              }
            >
              <Printer className="mr-1 h-4 w-4" /> Print / PDF
            </Button>
          </div>
        }
      />

      <Alert>
        <Receipt className="h-4 w-4" />
        <AlertTitle>Posted operational source</AlertTitle>
        <AlertDescription>
          Quick expenses post to the validated ledger immediately. Amounts, tax, account routing, and payment treatment are intentionally immutable after posting.
          {isLocked && (
            <span className="block pt-2 text-xs text-muted-foreground">
              This expense sits inside the closed period {periodState.data?.label}.
              {periodState.data?.reason ? ` ${periodState.data.reason}` : ""}
            </span>
          )}
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Description" value={detail.description} />
            <Row label="Date" value={formatDate(detail.date)} />
            <Row
              label="Account"
              value={
                detail.account ? (
                  <span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {detail.account.code}
                    </span>{" "}
                    {detail.account.name}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Row label="Method" value={methodLabel[detail.payment_method] ?? detail.payment_method} />
            {!detail.paid && (
              <Row
                label="Payable account"
                value={
                  detail.payable ? (
                    <span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {detail.payable.code}
                      </span>{" "}
                      {detail.payable.name}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
            )}
            <Row label="Supplier" value={detail.suppliers?.name ?? "—"} />
            <Row label="Branch" value={detail.branches?.name ?? "—"} />
            <Row
              label="Tax rate"
              value={
                detail.tax_rates
                  ? `${detail.tax_rates.name} · ${Number(detail.tax_rates.rate)}%`
                  : "No tax"
              }
            />
            <Row label="Created" value={formatDateTime(detail.created_at)} />
            <Separator className="my-2" />
            <Row label="Net" value={<MoneyDisplay value={detail.amount} currency={currency} />} />
            <Row
              label="Tax"
              value={<MoneyDisplay value={detail.tax_amount} currency={currency} muted />}
            />
            <Row
              label="Total"
              value={
                <MoneyDisplay
                  value={total}
                  currency={currency}
                  className="text-base font-semibold"
                />
              }
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <PostingAuditCard
            audit={postingAudit.data}
            currency={currency}
            isLoading={postingAudit.isLoading}
            emptyDescription="A quick expense should produce one posted expense journal immediately. If this stays empty after saving, treat it as a posting issue."
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4" /> Receipt
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!detail.receipt_url && (
                <p className="text-xs text-muted-foreground">No receipt attached.</p>
              )}
              {detail.receipt_url && !signedUrl && (
                <p className="text-xs text-muted-foreground">Loading receipt…</p>
              )}
              {isImage && (
                <a href={signedUrl!} target="_blank" rel="noreferrer">
                  <img
                    src={signedUrl!}
                    alt="Receipt"
                    className="mx-auto max-h-72 rounded border"
                  />
                </a>
              )}
              {isPdf && (
                <div className="space-y-2">
                  <iframe
                    src={signedUrl!}
                    className="h-64 w-full rounded border"
                    title="Receipt"
                  />
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <a href={signedUrl!} target="_blank" rel="noreferrer">
                      <FileText className="mr-1 h-3 w-3" /> Open PDF
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
