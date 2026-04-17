import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Receipt, Trash2, Pencil, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/data/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MoneyDisplay } from "@/components/data/MoneyDisplay";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import {
  useDeleteQuickExpense,
  useQuickExpense,
  getReceiptSignedUrl,
} from "@/features/quick-expenses/hooks";
import { useAuth } from "@/lib/auth";
import { QuickExpenseDrawer } from "@/components/quick-expenses/QuickExpenseDrawer";

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
  const navigate = useNavigate();
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";
  const { data, isLoading } = useQuickExpense(expenseId);
  const del = useDeleteQuickExpense();

  const [edit, setEdit] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const detail = data as QuickExpenseDetail | null;

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

  const handleDelete = async () => {
    if (!confirm("Delete this expense?")) return;
    try {
      await del.mutateAsync(expenseId);
      toast.success("Expense deleted");
      navigate({ to: "/quick-expenses" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const isImage = signedUrl && !/\.pdf(\?|$)/i.test(signedUrl);
  const isPdf = signedUrl && /\.pdf(\?|$)/i.test(signedUrl);

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
            <Button variant="outline" onClick={() => setEdit(true)}>
              <Pencil className="mr-1 h-4 w-4" /> Edit
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={handleDelete}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </div>
        }
      />

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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accounting impact</CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              <table className="w-full">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="pb-1 text-left font-medium">Account</th>
                    <th className="pb-1 text-right font-medium">Dr</th>
                    <th className="pb-1 text-right font-medium">Cr</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr>
                    <td className="py-0.5">
                      {detail.account
                        ? `${detail.account.code} ${detail.account.name}`
                        : "Expense"}
                    </td>
                    <td className="py-0.5 text-right">
                      {formatMoney(detail.amount, currency)}
                    </td>
                    <td className="py-0.5 text-right text-muted-foreground">—</td>
                  </tr>
                  {Number(detail.tax_amount) > 0 && (
                    <tr>
                      <td className="py-0.5">Input tax</td>
                      <td className="py-0.5 text-right">
                        {formatMoney(detail.tax_amount, currency)}
                      </td>
                      <td className="py-0.5 text-right text-muted-foreground">—</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-0.5">
                      {detail.paid
                        ? methodLabel[detail.payment_method]
                        : detail.payable
                          ? `${detail.payable.code} ${detail.payable.name}`
                          : "AP"}
                    </td>
                    <td className="py-0.5 text-right text-muted-foreground">—</td>
                    <td className="py-0.5 text-right">{formatMoney(total, currency)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td className="pt-1 text-[10px] uppercase text-muted-foreground">Balance</td>
                    <td className="pt-1 text-right">{formatMoney(total, currency)}</td>
                    <td className="pt-1 text-right">{formatMoney(total, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

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

      <QuickExpenseDrawer open={edit} onOpenChange={setEdit} expenseId={expenseId} />
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
