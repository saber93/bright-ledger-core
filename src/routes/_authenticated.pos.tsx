import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCompanySettings } from "@/features/settings/hooks";
import { useBranches, useRegisters } from "@/features/branches/hooks";
import { useCustomers } from "@/features/customers/hooks";
import { useProductsWithStock, type ProductWithStock } from "@/features/inventory/hooks";
import { useTaxRates } from "@/features/tax-rates/hooks";
import {
  useOpenCashSession,
  useCheckoutMutation,
  useHeldPosOrders,
  useHeldPosOrderDetail,
  useHoldCartMutation,
  useDeleteHeldCart,
  type CartLineInput,
  type PosPaymentMethod,
} from "@/features/pos/hooks";
import { useAuth } from "@/lib/auth";
import { useFinancePermissions } from "@/features/accounting/permissions";
import { openDocument } from "@/lib/open-document";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/data/EmptyState";
import { PageHeader } from "@/components/data/PageHeader";
import { formatMoney } from "@/lib/format";
import {
  Wallet,
  Search,
  Trash2,
  Pause,
  ShoppingBag,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Wallet2,
  Mail,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pos")({
  component: PosTerminal,
});

interface CartLine extends CartLineInput {
  uid: string; // local row id
}

function PosTerminal() {
  const { data: settings } = useCompanySettings();
  const { company, companyId } = useAuth();
  const { data: branches = [] } = useBranches();
  const { data: registers = [] } = useRegisters();
  const { data: products = [] } = useProductsWithStock();
  const { data: customers = [] } = useCustomers();
  const { data: taxRates = [] } = useTaxRates();
  const navigate = useNavigate();

  const finance = useFinancePermissions();
  const allowOverride =
    (Boolean(settings?.pos_allow_price_override) && finance.canOverridePosPrice) ||
    finance.canBypassPosOverrideSetting;

  // ---- Context state ----
  const [branchId, setBranchId] = useState<string | undefined>();
  const [registerId, setRegisterId] = useState<string | undefined>();

  useEffect(() => {
    if (!branchId && branches.length > 0) setBranchId(branches[0].id);
  }, [branches, branchId]);
  useEffect(() => {
    if (!branchId) return;
    const inBranch = registers.filter((r) => r.branch_id === branchId);
    if (inBranch.length === 0) {
      setRegisterId(undefined);
      return;
    }
    if (!registerId || !inBranch.find((r) => r.id === registerId)) {
      setRegisterId(inBranch[0].id);
    }
  }, [branchId, registers, registerId]);

  const currentRegister = registers.find((r) => r.id === registerId);
  const warehouseId = currentRegister?.default_warehouse_id ?? null;

  const { data: openSession } = useOpenCashSession(registerId);

  // ---- Cart state ----
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [resumeFromHeldId, setResumeFromHeldId] = useState<string | null>(null);

  // ---- Search / filter ----
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category_name) set.add(p.category_name);
    });
    return ["all", ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.is_active) return false;
      if (activeCategory !== "all" && p.category_name !== activeCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, query, activeCategory]);

  const defaultTaxRate = useMemo(() => {
    const def = taxRates.find((t) => t.is_default && t.is_active);
    return def ?? taxRates.find((t) => t.is_active) ?? null;
  }, [taxRates]);

  // ---- Cart actions ----
  function addProduct(p: ProductWithStock) {
    const tr = defaultTaxRate;
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === p.id);
      if (existing) {
        return prev.map((l) =>
          l.uid === existing.uid ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          uid: crypto.randomUUID(),
          product_id: p.id,
          description: p.name,
          is_service: p.type !== "goods",
          list_price: Number(p.sale_price),
          unit_price: Number(p.sale_price),
          quantity: 1,
          discount: 0,
          tax_rate: Number(p.tax_rate ?? tr?.rate ?? 0),
          tax_rate_id: tr?.id ?? null,
          price_override_reason: null,
          note: null,
        },
      ];
    });
  }

  function addAdHoc() {
    const tr = defaultTaxRate;
    setCart((prev) => [
      ...prev,
      {
        uid: crypto.randomUUID(),
        product_id: null,
        description: "Custom item",
        is_service: true,
        list_price: 0,
        unit_price: 0,
        quantity: 1,
        discount: 0,
        tax_rate: tr?.rate ?? 0,
        tax_rate_id: tr?.id ?? null,
        price_override_reason: null,
        note: null,
      },
    ]);
  }

  function updateLine(uid: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }

  function removeLine(uid: string) {
    setCart((prev) => prev.filter((l) => l.uid !== uid));
  }

  // ---- Totals ----
  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    for (const l of cart) {
      const gross = l.unit_price * l.quantity;
      const afterDiscount = Math.max(0, gross - l.discount);
      const t = afterDiscount * (l.tax_rate / 100);
      subtotal += afterDiscount;
      discount += l.discount;
      tax += t;
    }
    return { subtotal, discount, tax, total: subtotal + tax };
  }, [cart]);

  // ---- Mutations ----
  const checkout = useCheckoutMutation();
  const holdCart = useHoldCartMutation();
  const deleteHeld = useDeleteHeldCart();

  // ---- UI dialogs ----
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<CartLine | null>(null);

  function clearCart() {
    setCart([]);
    setCustomerId(null);
    setNotes("");
    setResumeFromHeldId(null);
  }

  async function onHold() {
    if (!branchId || !registerId) return;
    if (cart.length === 0) {
      toast.info("Cart is empty");
      return;
    }
    try {
      await holdCart.mutateAsync({
        branch_id: branchId,
        register_id: registerId,
        warehouse_id: warehouseId,
        session_id: openSession?.id ?? null,
        customer_id: customerId,
        notes,
        lines: cart.map(({ uid: _u, ...rest }) => rest),
      });
      toast.success("Cart held");
      clearCart();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // ---- Setup gate ----
  if (settings && !settings.pos_enabled) {
    return (
      <div>
        <PageHeader title="Point of Sale" description="Module disabled" />
        <EmptyState
          icon={<Wallet className="h-8 w-8" />}
          title="POS is disabled"
          description="Enable Point of Sale in Settings → Modules & Features."
        />
      </div>
    );
  }

  if (branches.length === 0 || registers.length === 0) {
    return (
      <div>
        <PageHeader title="Point of Sale" description="Setup required" />
        <EmptyState
          icon={<Wallet className="h-8 w-8" />}
          title="No branch or register configured"
          description="Add at least one branch and register in Settings → Branches & Registers."
        />
      </div>
    );
  }

  const needsSession = !openSession;

  return (
    <div className="-mx-6 -my-2 flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-card/40 px-4 py-2">
        <Wallet className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">POS</span>

        <div className="ml-2 flex items-center gap-2">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={registerId} onValueChange={setRegisterId}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="Register" />
            </SelectTrigger>
            <SelectContent>
              {registers
                .filter((r) => r.branch_id === branchId)
                .map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {settings?.cash_sessions_enabled && (
          <Badge variant={openSession ? "default" : "destructive"} className="ml-1">
            {openSession ? "Session open" : "No open session"}
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setHeldOpen(true)}>
            Held carts
          </Button>
          {settings?.cash_sessions_enabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/cash-sessions" })}
            >
              <Banknote className="mr-1 h-4 w-4" /> Sessions
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Catalog */}
        <div className="flex min-w-0 flex-1 flex-col border-r">
          <div className="space-y-2 border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, SKU, or barcode…"
                className="h-9 pl-8"
                autoFocus
              />
            </div>
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="h-8 flex-wrap">
                {categories.map((c) => (
                  <TabsTrigger key={c} value={c} className="text-xs capitalize">
                    {c === "all" ? "All" : c}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((p) => {
                const tracksStock = p.type === "goods";
                const out = tracksStock && p.total_stock <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    disabled={out}
                    className="group relative rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary hover:bg-accent disabled:opacity-40"
                  >
                    <div className="line-clamp-2 text-sm font-medium">{p.name}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{p.sku}</div>
                    <div className="mt-2 flex items-end justify-between">
                      <div className="text-base font-semibold">
                        {formatMoney(Number(p.sale_price), company?.currency)}
                      </div>
                      {tracksStock && (
                        <span
                          className={`text-[11px] ${
                            out
                              ? "text-destructive"
                              : p.is_low_stock
                                ? "text-amber-500"
                                : "text-muted-foreground"
                          }`}
                        >
                          {p.total_stock} {p.unit}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  No products match
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-2 text-right">
            <Button variant="ghost" size="sm" onClick={addAdHoc}>
              <Plus className="mr-1 h-4 w-4" /> Add custom item
            </Button>
          </div>
        </div>

        {/* Cart */}
        <div className="flex w-[420px] shrink-0 flex-col bg-muted/20">
          <div className="space-y-2 border-b bg-card/40 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Customer
              </Label>
              {customerId && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setCustomerId(null)}
                >
                  Clear
                </button>
              )}
            </div>
            <Select value={customerId ?? "guest"} onValueChange={(v) => setCustomerId(v === "guest" ? null : v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="guest">Guest / Walk-in</SelectItem>
                {customers
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2 p-3">
              {cart.length === 0 && (
                <div className="rounded-md border border-dashed py-10 text-center text-xs text-muted-foreground">
                  Tap a product to start a sale
                </div>
              )}
              {cart.map((l) => (
                <div key={l.uid} className="rounded-md border bg-card p-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <input
                        className="w-full truncate bg-transparent text-sm font-medium outline-none"
                        value={l.description}
                        onChange={(e) => updateLine(l.uid, { description: e.target.value })}
                      />
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {l.is_service ? "Service" : "Goods"} · {l.tax_rate}% tax
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(l.uid)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">
                        Qty
                      </Label>
                      <div className="mt-0.5 flex items-center rounded border bg-background">
                        <button
                          type="button"
                          className="grid h-7 w-7 place-items-center"
                          onClick={() =>
                            updateLine(l.uid, { quantity: Math.max(1, l.quantity - 1) })
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          className="w-full bg-transparent text-center text-sm outline-none"
                          type="number"
                          min={0}
                          step="1"
                          value={l.quantity}
                          onChange={(e) =>
                            updateLine(l.uid, { quantity: Number(e.target.value || 0) })
                          }
                        />
                        <button
                          type="button"
                          className="grid h-7 w-7 place-items-center"
                          onClick={() => updateLine(l.uid, { quantity: l.quantity + 1 })}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">
                        Price
                      </Label>
                      <Input
                        className="mt-0.5 h-7 px-2 text-sm"
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.unit_price}
                        onChange={(e) => {
                          const v = Number(e.target.value || 0);
                          if (v !== l.list_price && !allowOverride) {
                            toast.error(
                              "POS price overrides require finance permission and may be disabled in Settings.",
                            );
                            return;
                          }
                          if (v !== l.list_price && !l.price_override_reason) {
                            setOverrideTarget(l);
                            return;
                          }
                          updateLine(l.uid, { unit_price: v });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">
                        Discount
                      </Label>
                      <Input
                        className="mt-0.5 h-7 px-2 text-sm"
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.discount}
                        onChange={(e) =>
                          updateLine(l.uid, { discount: Number(e.target.value || 0) })
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {l.unit_price !== l.list_price && (
                        <span className="text-amber-500">
                          override · was {formatMoney(l.list_price, company?.currency)}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold">
                      {formatMoney(
                        Math.max(0, l.unit_price * l.quantity - l.discount) *
                          (1 + l.tax_rate / 100),
                        company?.currency,
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="space-y-2 border-t bg-card p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(totals.subtotal, company?.currency)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span>−{formatMoney(totals.discount, company?.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatMoney(totals.tax, company?.currency)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(totals.total, company?.currency)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmClearOpen(true)}
                disabled={cart.length === 0}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onHold}
                disabled={cart.length === 0}
              >
                <Pause className="mr-1 h-4 w-4" /> Hold
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (settings?.cash_sessions_enabled && needsSession) {
                    toast.error("Open a cash session first");
                    return;
                  }
                  if (cart.length === 0) return;
                  setPaymentOpen(true);
                }}
              >
                <ShoppingBag className="mr-1 h-4 w-4" /> Pay
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Held carts */}
      <HeldCartsSheet
        open={heldOpen}
        onOpenChange={setHeldOpen}
        onResume={(id, lines, customerId, notes) => {
          setCart(
            lines.map((l) => ({
              uid: crypto.randomUUID(),
              product_id: l.product_id,
              description: l.description,
              is_service: l.is_service,
              list_price: l.list_price,
              unit_price: l.unit_price,
              quantity: l.quantity,
              discount: l.discount,
              tax_rate: l.tax_rate,
              tax_rate_id: l.tax_rate_id,
              price_override_reason: l.price_override_reason,
              note: l.note,
            })),
          );
          setCustomerId(customerId);
          setNotes(notes ?? "");
          setResumeFromHeldId(id);
          setHeldOpen(false);
        }}
        onDelete={(id) => deleteHeld.mutate(id)}
      />

      {/* Clear confirm */}
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear cart?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all items, customer, and notes from the current sale.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearCart();
                setConfirmClearOpen(false);
              }}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Price override reason */}
      <PriceOverrideDialog
        line={overrideTarget}
        onClose={() => setOverrideTarget(null)}
        onConfirm={(reason, newPrice) => {
          if (overrideTarget) {
            updateLine(overrideTarget.uid, {
              unit_price: newPrice,
              price_override_reason: reason,
            });
          }
          setOverrideTarget(null);
        }}
        currency={company?.currency}
      />

      {/* Payment drawer */}
      <PaymentDrawer
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        total={totals.total}
        currency={company?.currency ?? "USD"}
        canCredit={!!customerId}
        submitting={checkout.isPending}
        onSubmit={async ({ payments, on_credit }) => {
          if (!branchId || !registerId) return;
          try {
            const result = await checkout.mutateAsync({
              branch_id: branchId,
              register_id: registerId,
              warehouse_id: warehouseId,
              session_id: openSession?.id ?? null,
              customer_id: customerId,
              notes: notes || null,
              lines: cart.map(({ uid: _u, ...rest }) => rest),
              payments,
              on_credit,
              resume_from_held_id: resumeFromHeldId,
            });
            toast.success(`Sale ${result.order_number} completed`);
            clearCart();
            setPaymentOpen(false);
            // Open receipt automatically in a new tab (HTML scaffold with auto window.print)
            void openDocument(`/api/documents/pos-receipt/${result.pos_order_id}`);
            try {
              localStorage.setItem("pos:last-receipt", result.pos_order_id);
            } catch {
              /* ignore */
            }
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      {/* Footer info */}
      <div className="border-t bg-card/40 px-4 py-1.5 text-[11px] text-muted-foreground">
        {currentRegister?.name ?? "—"} · Warehouse{" "}
        {warehouseId ? "linked" : "not set"} · {companyId ? "" : "no company"}
      </div>
    </div>
  );
}

// ============ Held carts sheet ============

function HeldCartsSheet(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResume: (
    id: string,
    lines: Array<Omit<CartLine, "uid">>,
    customerId: string | null,
    notes: string | null,
  ) => void;
  onDelete: (id: string) => void;
}) {
  const { data: held = [] } = useHeldPosOrders();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: detail } = useHeldPosOrderDetail(selected ?? undefined);

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>Held carts</SheetTitle>
          <SheetDescription>Resume a saved cart or delete it.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {held.length === 0 && (
            <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
              No held carts
            </div>
          )}
          {held.map((h) => (
            <div key={h.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{h.order_number}</div>
                <div className="text-sm font-semibold">
                  {formatMoney(Number(h.total))}
                </div>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {h.customers?.name ?? "Walk-in"} ·{" "}
                {new Date(h.created_at).toLocaleString()}
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setSelected(h.id)}
                >
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => props.onDelete(h.id)}
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>

        {detail?.order && detail.lines.length > 0 && selected && (
          <div className="mt-4 rounded-md border p-3">
            <div className="text-xs uppercase text-muted-foreground">Resume</div>
            <div className="mt-1 text-sm">
              {detail.lines.length} line(s) · {formatMoney(Number(detail.order.total))}
            </div>
            <Button
              className="mt-2 w-full"
              size="sm"
              onClick={() => {
                props.onResume(
                  detail.order!.id,
                  detail.lines.map((l) => ({
                    product_id: l.product_id,
                    description: l.description,
                    is_service: l.is_service,
                    list_price: Number(l.list_price),
                    unit_price: Number(l.unit_price),
                    quantity: Number(l.quantity),
                    discount: Number(l.discount),
                    tax_rate: Number(l.tax_rate),
                    tax_rate_id: l.tax_rate_id,
                    price_override_reason: l.price_override_reason,
                    note: l.note,
                  })),
                  detail.order!.customer_id,
                  detail.order!.notes,
                );
                // Delete the held shell
                void supabase
                  .from("pos_order_lines")
                  .delete()
                  .eq("order_id", detail.order!.id)
                  .then(() =>
                    supabase.from("pos_orders").delete().eq("id", detail.order!.id),
                  );
                setSelected(null);
              }}
            >
              Confirm resume
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ============ Price override dialog ============

function PriceOverrideDialog(props: {
  line: CartLine | null;
  onClose: () => void;
  onConfirm: (reason: string, newPrice: number) => void;
  currency?: string;
}) {
  const [reason, setReason] = useState("");
  const [price, setPrice] = useState<number>(props.line?.unit_price ?? 0);

  useEffect(() => {
    setReason(props.line?.price_override_reason ?? "");
    setPrice(props.line?.unit_price ?? 0);
  }, [props.line]);

  return (
    <Dialog open={!!props.line} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Price override</DialogTitle>
          <DialogDescription>
            List price was {formatMoney(props.line?.list_price ?? 0, props.currency)}.
            Provide a reason to override.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>New price</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value || 0))}
            />
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Manager approved discount, damaged item, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!reason.trim()) {
                toast.error("Reason is required");
                return;
              }
              props.onConfirm(reason.trim(), price);
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Payment drawer ============

interface PaymentInput {
  method: PosPaymentMethod;
  amount: number;
  reference: string | null;
}

function PaymentDrawer(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  currency: string;
  canCredit: boolean;
  submitting: boolean;
  onSubmit: (input: { payments: PaymentInput[]; on_credit: boolean }) => void;
}) {
  const [tenders, setTenders] = useState<PaymentInput[]>([
    { method: "cash", amount: props.total, reference: null },
  ]);
  const [onCredit, setOnCredit] = useState(false);

  useEffect(() => {
    if (props.open) {
      setOnCredit(false);
      setTenders([{ method: "cash", amount: props.total, reference: null }]);
    }
  }, [props.open, props.total]);

  const tendered = tenders.reduce((s, t) => s + Number(t.amount || 0), 0);
  const remaining = Math.max(0, props.total - tendered);
  const change = Math.max(0, tendered - props.total);

  function addTender(method: PosPaymentMethod) {
    setTenders((prev) => [
      ...prev,
      { method, amount: Math.max(0, props.total - tendered), reference: null },
    ]);
  }
  function updateTender(i: number, patch: Partial<PaymentInput>) {
    setTenders((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function removeTender(i: number) {
    setTenders((prev) => prev.filter((_, idx) => idx !== i));
  }

  const valid = onCredit || tendered + 0.0001 >= props.total;

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-[460px] sm:max-w-[460px]">
        <SheetHeader>
          <SheetTitle>Take payment</SheetTitle>
          <SheetDescription>
            Total due {formatMoney(props.total, props.currency)}
          </SheetDescription>
        </SheetHeader>

        {props.canCredit && (
          <div className="mt-3 rounded-md border bg-muted/30 p-3">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={onCredit}
                onChange={(e) => setOnCredit(e.target.checked)}
                className="mt-1"
              />
              <div className="text-sm">
                <div className="font-medium">Charge on credit</div>
                <div className="text-xs text-muted-foreground">
                  Invoice the customer; no payment recorded today.
                </div>
              </div>
            </label>
          </div>
        )}

        {!onCredit && (
          <>
            <div className="mt-4 space-y-2">
              {tenders.map((t, i) => (
                <div key={i} className="rounded-md border p-2">
                  <div className="flex items-center justify-between">
                    <Select
                      value={t.method}
                      onValueChange={(v) =>
                        updateTender(i, { method: v as PosPaymentMethod })
                      }
                    >
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="transfer">Bank transfer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {tenders.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTender(i)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] uppercase">Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={t.amount}
                        onChange={(e) =>
                          updateTender(i, { amount: Number(e.target.value || 0) })
                        }
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase">Reference</Label>
                      <Input
                        value={t.reference ?? ""}
                        onChange={(e) =>
                          updateTender(i, { reference: e.target.value || null })
                        }
                        placeholder="optional"
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => addTender("cash")}>
                <Banknote className="mr-1 h-3 w-3" /> Cash
              </Button>
              <Button variant="outline" size="sm" onClick={() => addTender("card")}>
                <CreditCard className="mr-1 h-3 w-3" /> Card
              </Button>
              <Button variant="outline" size="sm" onClick={() => addTender("transfer")}>
                <Wallet2 className="mr-1 h-3 w-3" /> Transfer
              </Button>
            </div>

            <div className="mt-4 space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span>{formatMoney(props.total, props.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tendered</span>
                <span>{formatMoney(tendered, props.currency)}</span>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Remaining</span>
                  <span>{formatMoney(remaining, props.currency)}</span>
                </div>
              )}
              {change > 0 && (
                <div className="flex justify-between font-semibold">
                  <span>Change</span>
                  <span>{formatMoney(change, props.currency)}</span>
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-6">
          <Button
            className="w-full"
            disabled={!valid || props.submitting}
            onClick={() => {
              const finalTenders = onCredit
                ? []
                : tenders
                    .filter((t) => Number(t.amount) > 0)
                    .map((t, idx, arr) => ({
                      ...t,
                      // Only the last cash tender gets the "change_due"
                      change_due:
                        t.method === "cash" && idx === arr.length - 1 ? change : 0,
                    }));
              props.onSubmit({ payments: finalTenders, on_credit: onCredit });
            }}
          >
            {props.submitting
              ? "Processing…"
              : onCredit
                ? "Complete on credit"
                : "Complete sale"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
