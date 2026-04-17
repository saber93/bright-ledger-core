import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, Upload, FileText, X, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Link } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChartOfAccounts } from "@/features/accounting/hooks";
import { useBranches } from "@/features/branches/hooks";
import { useSuppliers } from "@/features/suppliers/hooks";
import { useTaxRates } from "@/features/tax-rates/hooks";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import {
  uploadExpenseReceipt,
  getReceiptSignedUrl,
  useDeleteQuickExpense,
  useQuickExpense,
  useUpsertQuickExpense,
  type QuickExpenseInput,
  type QuickExpenseMethod,
} from "@/features/quick-expenses/hooks";

const METHODS: { value: QuickExpenseMethod; label: string; paidByDefault: boolean }[] = [
  { value: "cash", label: "Cash", paidByDefault: true },
  { value: "bank", label: "Bank transfer", paidByDefault: true },
  { value: "card", label: "Card", paidByDefault: true },
  { value: "petty_cash", label: "Petty cash", paidByDefault: true },
  { value: "unpaid", label: "Unpaid (on credit)", paidByDefault: false },
  { value: "other", label: "Other", paidByDefault: true },
];

export function QuickExpenseDrawer({
  open,
  onOpenChange,
  expenseId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expenseId?: string | null;
}) {
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";
  const isEdit = !!expenseId;

  const { data: existing, isLoading: loadingExisting } = useQuickExpense(expenseId ?? undefined);
  const { data: accounts } = useChartOfAccounts();
  const { data: suppliers } = useSuppliers();
  const { data: branches } = useBranches();
  const { data: taxRates } = useTaxRates();

  const expenseAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.type === "expense" && a.is_active),
    [accounts],
  );
  const liabilityAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.type === "liability" && a.is_active),
    [accounts],
  );

  const upsert = useUpsertQuickExpense();
  const del = useDeleteQuickExpense();

  const [form, setForm] = useState<QuickExpenseInput>({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: 0,
    tax_amount: 0,
    payment_method: "cash",
    paid: true,
    account_id: null,
    payable_account_id: null,
    tax_rate_id: null,
    supplier_id: null,
    branch_id: null,
    receipt_url: null,
  });

  const [uploading, setUploading] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  // Hydrate form from existing
  useEffect(() => {
    if (!open) return;
    if (existing && isEdit) {
      const e = existing as unknown as {
        date: string;
        description: string;
        amount: number;
        tax_amount: number;
        payment_method: QuickExpenseMethod;
        paid: boolean;
        account_id: string | null;
        payable_account_id: string | null;
        tax_rate_id: string | null;
        supplier_id: string | null;
        branch_id: string | null;
        receipt_url: string | null;
      };
      setForm({
        id: expenseId!,
        date: e.date,
        description: e.description,
        amount: Number(e.amount),
        tax_amount: Number(e.tax_amount ?? 0),
        payment_method: e.payment_method,
        paid: e.paid,
        account_id: e.account_id,
        payable_account_id: e.payable_account_id,
        tax_rate_id: e.tax_rate_id,
        supplier_id: e.supplier_id,
        branch_id: e.branch_id,
        receipt_url: e.receipt_url,
      });
    } else if (!isEdit) {
      // Reset to fresh
      setForm({
        date: new Date().toISOString().slice(0, 10),
        description: "",
        amount: 0,
        tax_amount: 0,
        payment_method: "cash",
        paid: true,
        account_id: expenseAccounts[0]?.id ?? null,
        payable_account_id: null,
        tax_rate_id: null,
        supplier_id: null,
        branch_id: null,
        receipt_url: null,
      });
    }
    setReceiptPreview(null);
  }, [open, existing, isEdit, expenseId, expenseAccounts]);

  // Auto-compute tax from selected tax rate
  useEffect(() => {
    if (!form.tax_rate_id || !taxRates) return;
    const rate = taxRates.find((t) => t.id === form.tax_rate_id);
    if (!rate) return;
    const tax = Number(form.amount) * (Number(rate.rate) / 100);
    setForm((f) => ({ ...f, tax_amount: Number(tax.toFixed(2)) }));
  }, [form.tax_rate_id, form.amount, taxRates]);

  // Method changes update paid default
  const onMethodChange = (m: QuickExpenseMethod) => {
    const def = METHODS.find((x) => x.value === m);
    setForm((f) => ({ ...f, payment_method: m, paid: def?.paidByDefault ?? f.paid }));
  };

  const handleUpload = async (file: File | null) => {
    if (!file || !company?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5 MB)");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadExpenseReceipt(company.id, file);
      setForm((f) => ({ ...f, receipt_url: path }));
      toast.success("Receipt uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const previewReceipt = async () => {
    if (!form.receipt_url) return;
    const url = await getReceiptSignedUrl(form.receipt_url);
    if (url) setReceiptPreview(url);
    else toast.error("Couldn't load receipt");
  };

  const total = Number(form.amount || 0) + Number(form.tax_amount || 0);
  const accountObj = expenseAccounts.find((a) => a.id === form.account_id);
  const payableObj = liabilityAccounts.find((a) => a.id === form.payable_account_id);

  const submit = async () => {
    if (!form.description.trim()) {
      toast.error("Add a description");
      return;
    }
    if (!form.amount || form.amount <= 0) {
      toast.error("Amount must be > 0");
      return;
    }
    if (!form.account_id) {
      toast.error("Pick an expense account");
      return;
    }
    if (!form.paid && !form.payable_account_id) {
      toast.error("Unpaid expenses need a payable account");
      return;
    }

    try {
      const id = await upsert.mutateAsync(form);
      toast.success(isEdit ? "Expense updated" : "Expense saved");
      onOpenChange(false);
      // Navigate to detail for newly created ones
      if (!isEdit) {
        // soft route navigate via hash since list already auto-refreshes; opening detail page:
        window.location.href = `/quick-expenses/${id}`;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const handleDelete = async () => {
    if (!expenseId) return;
    if (!confirm("Delete this expense?")) return;
    try {
      await del.mutateAsync(expenseId);
      toast.success("Expense deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit expense" : "New quick expense"}</SheetTitle>
          <SheetDescription>
            For petty cash, fuel, supplies and other day-to-day costs. Use Supplier Bills for
            full invoices from suppliers.
          </SheetDescription>
        </SheetHeader>

        {loadingExisting && isEdit ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Branch</Label>
                <Select
                  value={form.branch_id ?? "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, branch_id: v === "none" ? null : v })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Branch (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {(branches ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Diesel for delivery van, office supplies, parking…"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (net)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.amount || ""}
                  onChange={(e) =>
                    setForm({ ...form, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Tax rate</Label>
                <Select
                  value={form.tax_rate_id ?? "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, tax_rate_id: v === "none" ? null : v })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="No tax" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No tax (0%)</SelectItem>
                    {(taxRates ?? [])
                      .filter((t) => t.is_active && (t.type === "purchase" || t.type === "both"))
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} · {Number(t.rate)}%
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tax amount</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.tax_amount || ""}
                  onChange={(e) =>
                    setForm({ ...form, tax_amount: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-1"
                />
              </div>
              <div className="flex flex-col justify-end">
                <Label className="mb-1 text-xs uppercase text-muted-foreground">Total</Label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-right font-mono text-base font-semibold tabular-nums">
                  {formatMoney(total, currency)}
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <Label>Expense account</Label>
              <Select
                value={form.account_id ?? ""}
                onValueChange={(v) => setForm({ ...form, account_id: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pick an expense account" />
                </SelectTrigger>
                <SelectContent>
                  {expenseAccounts.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      No expense accounts. Add some in Chart of Accounts.
                    </div>
                  )}
                  {expenseAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-mono text-xs text-muted-foreground">{a.code}</span>{" "}
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment method</Label>
                <Select
                  value={form.payment_method}
                  onValueChange={(v) => onMethodChange(v as QuickExpenseMethod)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3 rounded-md border bg-card p-2.5">
                <Switch
                  id="paid-switch"
                  checked={form.paid}
                  onCheckedChange={(v) => setForm({ ...form, paid: v })}
                />
                <Label htmlFor="paid-switch" className="text-sm">
                  {form.paid ? "Paid now" : "Unpaid (on credit)"}
                </Label>
              </div>
            </div>

            {!form.paid && (
              <div>
                <Label>Payable account (where to book the liability)</Label>
                <Select
                  value={form.payable_account_id ?? ""}
                  onValueChange={(v) => setForm({ ...form, payable_account_id: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pick a payable / liability account" />
                  </SelectTrigger>
                  <SelectContent>
                    {liabilityAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="font-mono text-xs text-muted-foreground">{a.code}</span>{" "}
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Supplier (optional)</Label>
              <Select
                value={form.supplier_id ?? "none"}
                onValueChange={(v) =>
                  setForm({ ...form, supplier_id: v === "none" ? null : v })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Link to a supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {(suppliers ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div>
              <Label>Receipt</Label>
              <div className="mt-1 flex items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-accent">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                  />
                </label>
                {form.receipt_url && (
                  <>
                    <Button variant="outline" size="sm" onClick={previewReceipt} type="button">
                      <Eye className="mr-1 h-3 w-3" /> Preview
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, receipt_url: null })}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <span className="truncate text-xs text-muted-foreground">
                      <FileText className="mr-1 inline h-3 w-3" />
                      {form.receipt_url.split("/").pop()}
                    </span>
                  </>
                )}
              </div>
            </div>

            {receiptPreview && (
              <div className="rounded-md border bg-muted/30 p-2">
                {receiptPreview.match(/\.pdf(\?|$)/i) ? (
                  <iframe
                    src={receiptPreview}
                    className="h-72 w-full rounded"
                    title="Receipt preview"
                  />
                ) : (
                  <img
                    src={receiptPreview}
                    alt="Receipt"
                    className="mx-auto max-h-80 rounded"
                  />
                )}
              </div>
            )}

            {/* Accounting impact preview */}
            <div className="rounded-lg border bg-muted/20 p-3 text-xs">
              <div className="mb-1.5 font-semibold text-foreground">Accounting impact</div>
              <table className="w-full">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium">Account</th>
                    <th className="text-right font-medium">Debit</th>
                    <th className="text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr>
                    <td>
                      {accountObj
                        ? `${accountObj.code} · ${accountObj.name}`
                        : "Expense account"}
                    </td>
                    <td className="text-right">{formatMoney(form.amount, currency)}</td>
                    <td className="text-right text-muted-foreground">—</td>
                  </tr>
                  {Number(form.tax_amount) > 0 && (
                    <tr>
                      <td>Input tax</td>
                      <td className="text-right">{formatMoney(form.tax_amount, currency)}</td>
                      <td className="text-right text-muted-foreground">—</td>
                    </tr>
                  )}
                  <tr>
                    <td>
                      {form.paid
                        ? form.payment_method === "cash" || form.payment_method === "petty_cash"
                          ? "Cash on hand"
                          : form.payment_method === "bank"
                            ? "Bank account"
                            : form.payment_method === "card"
                              ? "Card clearing"
                              : "Payment account"
                        : payableObj
                          ? `${payableObj.code} · ${payableObj.name}`
                          : "Accounts payable"}
                    </td>
                    <td className="text-right text-muted-foreground">—</td>
                    <td className="text-right">{formatMoney(total, currency)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="sticky bottom-0 -mx-6 flex items-center justify-between border-t bg-background px-6 pb-2 pt-3">
              {isEdit ? (
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive">
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                {isEdit && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/quick-expenses/$expenseId" params={{ expenseId: expenseId! }}>
                      Open detail
                    </Link>
                  </Button>
                )}
                <Button onClick={submit} disabled={upsert.isPending}>
                  {upsert.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  {isEdit ? "Save changes" : "Save expense"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
