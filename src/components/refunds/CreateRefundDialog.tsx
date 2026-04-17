import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useInvoices } from "@/features/invoices/hooks";
import { usePosOrders } from "@/features/pos/hooks";
import { useBranches, useRegisters } from "@/features/branches/hooks";
import {
  useCreateRefundMutation,
  useInvoiceForRefund,
  usePosOrderForRefund,
  type AllocationInput,
  type RefundLineInput,
} from "@/features/refunds/hooks";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

type SourceType = "invoice" | "pos";

interface LineDraft {
  source_line_id: string;
  description: string;
  product_id: string | null;
  unit_price: number;
  tax_rate: number;
  max_qty: number;
  qty: number;
  is_service: boolean;
}

export function CreateRefundDialog({
  open,
  onOpenChange,
  defaultSourceType,
  defaultSourceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultSourceType?: SourceType;
  defaultSourceId?: string;
}) {
  const navigate = useNavigate();
  const { company } = useAuth();
  const currency = company?.currency ?? "USD";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sourceType, setSourceType] = useState<SourceType>(defaultSourceType ?? "invoice");
  const [sourceId, setSourceId] = useState<string | null>(defaultSourceId ?? null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [restock, setRestock] = useState(false);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [allocs, setAllocs] = useState<AllocationInput[]>([]);
  const [search, setSearch] = useState("");

  const { data: invoices } = useInvoices();
  const { data: posOrders } = usePosOrders(200);
  const { data: branches } = useBranches();
  const { data: registers } = useRegisters();

  const invoiceForRefund = useInvoiceForRefund(
    sourceType === "invoice" ? (sourceId ?? undefined) : undefined,
  );
  const posForRefund = usePosOrderForRefund(
    sourceType === "pos" ? (sourceId ?? undefined) : undefined,
  );

  const create = useCreateRefundMutation();

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setSourceType(defaultSourceType ?? "invoice");
      setSourceId(defaultSourceId ?? null);
      setReason("");
      setNotes("");
      setRestock(false);
      setWarehouseId(null);
      setLines([]);
      setAllocs([]);
      setSearch("");
    }
  }, [open, defaultSourceType, defaultSourceId]);

  // Hydrate lines when source loads
  useEffect(() => {
    if (sourceType === "invoice" && invoiceForRefund.data) {
      const data = invoiceForRefund.data as {
        invoice: { warehouse_id?: string | null } | null;
        lines: Array<{
          id: string;
          description: string;
          quantity: number;
          unit_price: number;
          tax_rate: number;
          refunded_qty: number;
        }>;
      };
      setLines(
        (data.lines ?? []).map((l) => ({
          source_line_id: l.id,
          description: l.description,
          product_id: null,
          unit_price: Number(l.unit_price),
          tax_rate: Number(l.tax_rate),
          max_qty: Math.max(0, Number(l.quantity) - Number(l.refunded_qty)),
          qty: 0,
          is_service: true,
        })),
      );
    }
    if (sourceType === "pos" && posForRefund.data) {
      const data = posForRefund.data as {
        order: { warehouse_id: string | null } | null;
        lines: Array<{
          id: string;
          description: string;
          product_id: string | null;
          quantity: number;
          unit_price: number;
          tax_rate: number;
          is_service: boolean;
          refunded_qty: number;
        }>;
      };
      setWarehouseId(data.order?.warehouse_id ?? null);
      setLines(
        (data.lines ?? []).map((l) => ({
          source_line_id: l.id,
          description: l.description,
          product_id: l.product_id,
          unit_price: Number(l.unit_price),
          tax_rate: Number(l.tax_rate),
          max_qty: Math.max(0, Number(l.quantity) - Number(l.refunded_qty)),
          qty: 0,
          is_service: !!l.is_service,
        })),
      );
    }
  }, [sourceType, invoiceForRefund.data, posForRefund.data]);

  const sourceMeta = useMemo(() => {
    if (sourceType === "invoice" && invoiceForRefund.data) {
      const inv = (invoiceForRefund.data as { invoice: { id: string; invoice_number: string; total: number; customers: { id: string; name: string } | null } | null }).invoice;
      return inv
        ? {
            label: `Invoice ${inv.invoice_number}`,
            customerId: inv.customers?.id ?? null,
            customerName: inv.customers?.name ?? null,
            total: Number(inv.total),
          }
        : null;
    }
    if (sourceType === "pos" && posForRefund.data) {
      const ord = (posForRefund.data as { order: { id: string; order_number: string; total: number; customers: { id: string; name: string } | null } | null }).order;
      return ord
        ? {
            label: `POS ${ord.order_number}`,
            customerId: ord.customers?.id ?? null,
            customerName: ord.customers?.name ?? null,
            total: Number(ord.total),
          }
        : null;
    }
    return null;
  }, [sourceType, invoiceForRefund.data, posForRefund.data]);

  // Totals
  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of lines) {
      const net = l.unit_price * l.qty;
      subtotal += net;
      tax += net * (l.tax_rate / 100);
    }
    return { subtotal, tax, total: subtotal + tax };
  }, [lines]);

  const allocSum = allocs.reduce((s, a) => s + Number(a.amount || 0), 0);
  const remaining = Number((totals.total - allocSum).toFixed(2));

  const sourceList = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (sourceType === "invoice") {
      return (invoices ?? [])
        .filter(
          (i) =>
            !term ||
            i.invoice_number.toLowerCase().includes(term) ||
            i.customer_name.toLowerCase().includes(term),
        )
        .slice(0, 50);
    }
    return (posOrders ?? [])
      .filter(
        (o) =>
          !term ||
          o.order_number.toLowerCase().includes(term) ||
          (o.customers?.name ?? "").toLowerCase().includes(term),
      )
      .slice(0, 50);
  }, [sourceType, invoices, posOrders, search]);

  const hasGoodsToRestock = lines.some((l) => l.qty > 0 && !l.is_service && l.product_id);
  const cashAlloc = allocs.find((a) => a.target_type === "cash_refund");

  const setAllocAmount = (idx: number, amount: number) => {
    setAllocs((prev) => prev.map((a, i) => (i === idx ? { ...a, amount } : a)));
  };
  const setAllocField = <K extends keyof AllocationInput>(
    idx: number,
    key: K,
    val: AllocationInput[K],
  ) => {
    setAllocs((prev) => prev.map((a, i) => (i === idx ? { ...a, [key]: val } : a)));
  };

  const addAlloc = (target: AllocationInput["target_type"]) => {
    const defaults: AllocationInput = {
      target_type: target,
      amount: Math.max(0, remaining),
    };
    if (target === "invoice") defaults.target_invoice_id = sourceType === "invoice" ? sourceId : null;
    if (target === "cash_refund") defaults.refund_method = "cash";
    setAllocs((prev) => [...prev, defaults]);
  };

  const submit = async () => {
    if (totals.total <= 0) {
      toast.error("Refund some quantity first");
      return;
    }
    if (Math.abs(remaining) > 0.01) {
      toast.error(`Allocate exactly ${formatMoney(totals.total, currency)}`);
      return;
    }
    const refundLines: RefundLineInput[] = lines
      .filter((l) => l.qty > 0)
      .map((l) => ({
        description: l.description,
        quantity: l.qty,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        product_id: l.product_id,
        source_line_id: l.source_line_id,
        source_line_type: sourceType === "invoice" ? "invoice_line" : "pos_order_line",
      }));

    // For cash session linkage when cash refund + register selected: try active session
    let allocsResolved = allocs;
    if (cashAlloc?.refund_method === "cash" && cashAlloc.register_id) {
      const { data: session } = await supabase
        .from("cash_sessions")
        .select("id")
        .eq("register_id", cashAlloc.register_id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (session) {
        allocsResolved = allocs.map((a) =>
          a.target_type === "cash_refund" ? { ...a, session_id: session.id } : a,
        );
      }
    }

    try {
      const id = await create.mutateAsync({
        source_type: sourceType,
        source_invoice_id: sourceType === "invoice" ? sourceId : null,
        source_pos_order_id: sourceType === "pos" ? sourceId : null,
        customer_id: sourceMeta?.customerId ?? null,
        reason: reason || null,
        notes: notes || null,
        restock,
        warehouse_id: restock ? warehouseId : null,
        lines: refundLines,
        allocations: allocsResolved,
      });
      toast.success("Refund issued");
      onOpenChange(false);
      navigate({ to: "/refunds/$creditNoteId", params: { creditNoteId: id } }).catch(() => {
        window.location.href = `/refunds/${id}`;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to issue refund");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New refund / credit note</DialogTitle>
          <DialogDescription>
            Step {step} of 3 ·{" "}
            {step === 1 ? "Pick source" : step === 2 ? "Select lines & qty" : "Allocate refund"}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={sourceType === "invoice" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSourceType("invoice");
                  setSourceId(null);
                }}
              >
                Invoice
              </Button>
              <Button
                variant={sourceType === "pos" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSourceType("pos");
                  setSourceId(null);
                }}
              >
                POS order
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search number or customer…"
                className="pl-8"
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              {sourceList.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No matching {sourceType === "invoice" ? "invoices" : "POS orders"}.
                </div>
              )}
              {sourceList.map((r) => {
                const id = r.id as string;
                const num = sourceType === "invoice"
                  ? (r as { invoice_number: string }).invoice_number
                  : (r as { order_number: string }).order_number;
                const cust = sourceType === "invoice"
                  ? (r as { customer_name: string }).customer_name
                  : ((r as { customers: { name: string } | null }).customers?.name ?? "Walk-in");
                const total = Number((r as { total: number }).total);
                const cur = (r as { currency: string }).currency;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSourceId(id)}
                    className={`flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent/50 ${
                      sourceId === id ? "bg-accent/60" : ""
                    }`}
                  >
                    <div>
                      <div className="font-mono text-xs">{num}</div>
                      <div className="text-xs text-muted-foreground">{cust}</div>
                    </div>
                    <div className="font-mono text-sm">{formatMoney(total, cur)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-4">
            {sourceMeta && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <span className="font-medium">{sourceMeta.label}</span>
                {sourceMeta.customerName && (
                  <span className="text-muted-foreground"> · {sourceMeta.customerName}</span>
                )}
                <span className="float-right font-mono">
                  {formatMoney(sourceMeta.total, currency)}
                </span>
              </div>
            )}

            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Item</th>
                    <th className="px-2 py-1.5 text-right">Unit</th>
                    <th className="px-2 py-1.5 text-right">Refundable</th>
                    <th className="px-2 py-1.5 text-right">Qty</th>
                    <th className="px-2 py-1.5 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-xs text-muted-foreground">
                        Loading lines…
                      </td>
                    </tr>
                  )}
                  {lines.map((l, i) => {
                    const lineNet = l.unit_price * l.qty;
                    const lineTotal = lineNet * (1 + l.tax_rate / 100);
                    const exceeds = l.qty > l.max_qty;
                    return (
                      <tr key={l.source_line_id} className="border-t">
                        <td className="px-2 py-2">
                          <div className="font-medium">{l.description}</div>
                          {!l.is_service && (
                            <Badge variant="secondary" className="mt-0.5 h-4 text-[10px]">
                              goods
                            </Badge>
                          )}
                          {l.tax_rate > 0 && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              · {l.tax_rate}% tax
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs">
                          {formatMoney(l.unit_price, currency)}
                        </td>
                        <td className="px-2 py-2 text-right text-xs text-muted-foreground">
                          {l.max_qty}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            max={l.max_qty}
                            step="0.01"
                            value={l.qty || ""}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              const clamped = Math.min(Math.max(0, v), l.max_qty);
                              setLines((prev) =>
                                prev.map((x, ix) =>
                                  ix === i ? { ...x, qty: clamped } : x,
                                ),
                              );
                            }}
                            className={`h-8 w-20 text-right ${exceeds ? "border-destructive" : ""}`}
                            disabled={l.max_qty === 0}
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          {formatMoney(lineTotal, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLines((prev) => prev.map((l) => ({ ...l, qty: l.max_qty })))
                }
              >
                Refund all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLines((prev) => prev.map((l) => ({ ...l, qty: 0 })))}
              >
                Clear
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Reason</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Damaged, wrong item, customer changed mind…"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 min-h-[40px]"
                />
              </div>
            </div>

            {hasGoodsToRestock && (
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Restock returned items</Label>
                    <p className="text-xs text-muted-foreground">
                      Add quantities back to inventory.
                    </p>
                  </div>
                  <Switch checked={restock} onCheckedChange={setRestock} />
                </div>
                {restock && (
                  <div className="mt-2 text-xs">
                    <div className="text-muted-foreground">
                      Stock will be received at warehouse:{" "}
                      <span className="font-mono text-foreground">
                        {warehouseId ?? "(POS order default)"}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {lines
                        .filter((l) => l.qty > 0 && !l.is_service && l.product_id)
                        .map((l) => (
                          <div key={l.source_line_id} className="flex justify-between">
                            <span>{l.description}</span>
                            <span className="font-mono text-success">+{l.qty}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{formatMoney(totals.subtotal, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-mono">{formatMoney(totals.tax, currency)}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>Refund total</span>
                <span className="font-mono">{formatMoney(totals.total, currency)}</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Refund total</span>
                <span className="font-mono font-semibold">
                  {formatMoney(totals.total, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Allocated</span>
                <span className="font-mono">{formatMoney(allocSum, currency)}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>Remaining</span>
                <span
                  className={`font-mono ${
                    Math.abs(remaining) < 0.01
                      ? "text-success"
                      : remaining < 0
                        ? "text-destructive"
                        : "text-warning-foreground"
                  }`}
                >
                  {formatMoney(remaining, currency)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {sourceType === "invoice" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addAlloc("invoice")}
                  disabled={remaining <= 0}
                >
                  + Reduce invoice balance
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => addAlloc("customer_credit")}
                disabled={remaining <= 0 || !sourceMeta?.customerId}
              >
                + Customer credit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addAlloc("cash_refund")}
                disabled={remaining <= 0}
              >
                + Cash refund
              </Button>
            </div>

            <div className="space-y-2">
              {allocs.map((a, i) => (
                <div key={i} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {a.target_type.replace("_", " ")}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAllocs((prev) => prev.filter((_, ix) => ix !== i))}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={a.amount || ""}
                        onChange={(e) => setAllocAmount(i, parseFloat(e.target.value) || 0)}
                        className="mt-1 h-8"
                      />
                    </div>
                    {a.target_type === "cash_refund" && (
                      <>
                        <div>
                          <Label className="text-xs">Method</Label>
                          <Select
                            value={a.refund_method ?? "cash"}
                            onValueChange={(v) =>
                              setAllocField(
                                i,
                                "refund_method",
                                v as AllocationInput["refund_method"],
                              )
                            }
                          >
                            <SelectTrigger className="mt-1 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Branch</Label>
                          <Select
                            value={a.branch_id ?? "none"}
                            onValueChange={(v) =>
                              setAllocField(i, "branch_id", v === "none" ? null : v)
                            }
                          >
                            <SelectTrigger className="mt-1 h-8">
                              <SelectValue placeholder="Branch" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {(branches ?? []).map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Register (for till impact)</Label>
                          <Select
                            value={a.register_id ?? "none"}
                            onValueChange={(v) =>
                              setAllocField(i, "register_id", v === "none" ? null : v)
                            }
                          >
                            <SelectTrigger className="mt-1 h-8">
                              <SelectValue placeholder="Register" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {(registers ?? [])
                                .filter((r) => !a.branch_id || r.branch_id === a.branch_id)
                                .map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Reference</Label>
                          <Input
                            value={a.refund_reference ?? ""}
                            onChange={(e) =>
                              setAllocField(i, "refund_reference", e.target.value)
                            }
                            placeholder="Receipt #, txn id…"
                            className="mt-1 h-8"
                          />
                        </div>
                      </>
                    )}
                    {a.target_type === "invoice" && sourceType !== "invoice" && (
                      <div>
                        <Label className="text-xs">Target invoice</Label>
                        <Select
                          value={a.target_invoice_id ?? ""}
                          onValueChange={(v) => setAllocField(i, "target_invoice_id", v)}
                        >
                          <SelectTrigger className="mt-1 h-8">
                            <SelectValue placeholder="Pick invoice" />
                          </SelectTrigger>
                          <SelectContent>
                            {(invoices ?? []).map((inv) => (
                              <SelectItem key={inv.id} value={inv.id}>
                                {inv.invoice_number} · {inv.customer_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {allocs.length === 0 && (
                <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                  Add at least one allocation to cover the refund total.
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 1 ? onOpenChange(false) : setStep((step - 1) as 1 | 2))}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((step + 1) as 2 | 3)}
              disabled={
                (step === 1 && !sourceId) ||
                (step === 2 && totals.total <= 0)
              }
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={submit}
              disabled={create.isPending || Math.abs(remaining) > 0.01 || totals.total <= 0}
            >
              {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Issue refund
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
