import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useTaxRates,
  useCreateTaxRate,
  useUpdateTaxRate,
  useDeleteTaxRate,
  type TaxRate,
  type TaxRateType,
} from "@/features/tax-rates/hooks";
import { useChartOfAccounts } from "@/features/accounting/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/data/EmptyState";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings/tax-rates")({
  component: TaxRatesPage,
});

function TaxRatesPage() {
  const { data: rates, isLoading } = useTaxRates();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaxRate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TaxRate | null>(null);
  const del = useDeleteTaxRate();

  const onNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const onEdit = (r: TaxRate) => {
    setEditing(r);
    setOpen(true);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Tax Rates</h2>
          <p className="text-xs text-muted-foreground">
            Configure the tax rates used across invoices, bills, POS, and expenses.
          </p>
        </div>
        <Button size="sm" onClick={onNew}>
          <Plus className="mr-1.5 h-4 w-4" /> New tax rate
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !rates || rates.length === 0 ? (
        <EmptyState
          icon={<Tag className="h-8 w-8" />}
          title="No tax rates yet"
          description="Add the tax rates your business uses, then assign them on products and documents."
          action={
            <Button onClick={onNew}>
              <Plus className="mr-1.5 h-4 w-4" /> New tax rate
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Effective from</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.name}
                    {r.is_default && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        DEFAULT
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">{Number(r.rate).toFixed(2)}%</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {r.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.is_inclusive ? "Tax inclusive" : "Tax exclusive"}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(r.effective_from)}</TableCell>
                  <TableCell>
                    {r.is_active ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(r)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TaxRateDrawer open={open} onOpenChange={setOpen} editing={editing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tax rate?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Documents already using this rate will keep their numbers but
              you won't be able to assign it to new ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await del.mutateAsync(confirmDelete.id);
                  toast.success("Tax rate deleted");
                  setConfirmDelete(null);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaxRateDrawer({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: TaxRate | null;
}) {
  const create = useCreateTaxRate();
  const update = useUpdateTaxRate();
  const { data: accounts } = useChartOfAccounts();

  const [name, setName] = useState(editing?.name ?? "");
  const [rate, setRate] = useState(String(editing?.rate ?? "0"));
  const [type, setType] = useState<TaxRateType>(editing?.type ?? "both");
  const [isInclusive, setIsInclusive] = useState(editing?.is_inclusive ?? false);
  const [accountId, setAccountId] = useState<string>(editing?.account_id ?? "");
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? false);
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);
  const [effectiveFrom, setEffectiveFrom] = useState(
    editing?.effective_from ?? new Date().toISOString().slice(0, 10),
  );
  const [effectiveTo, setEffectiveTo] = useState(editing?.effective_to ?? "");

  // Reset when drawer opens with different editing target
  const key = `${open}-${editing?.id ?? "new"}`;

  const submit = async () => {
    try {
      const payload = {
        name,
        rate: Number(rate),
        type,
        is_inclusive: isInclusive,
        account_id: accountId || null,
        is_default: isDefault,
        is_active: isActive,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
      };
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload });
        toast.success("Tax rate updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Tax rate created");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setName(editing?.name ?? "");
          setRate(String(editing?.rate ?? "0"));
          setType(editing?.type ?? "both");
          setIsInclusive(editing?.is_inclusive ?? false);
          setAccountId(editing?.account_id ?? "");
          setIsDefault(editing?.is_default ?? false);
          setIsActive(editing?.is_active ?? true);
          setEffectiveFrom(editing?.effective_from ?? new Date().toISOString().slice(0, 10));
          setEffectiveTo(editing?.effective_to ?? "");
        }
        onOpenChange(v);
      }}
      key={key}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit tax rate" : "New tax rate"}</SheetTitle>
          <SheetDescription>
            Tax rates can be assigned to products, invoice lines, POS items, and quick expenses.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VAT 15%" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Applies to</Label>
              <Select value={type} onValueChange={(v) => setType(v as TaxRateType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <Switch checked={isInclusive} onCheckedChange={setIsInclusive} />
            <div className="min-w-0 flex-1">
              <Label className="text-sm">Tax inclusive pricing</Label>
              <p className="text-xs text-muted-foreground">
                When on, the listed unit price already contains this tax.
              </p>
            </div>
          </div>

          <div>
            <Label className="text-xs">Linked account (optional)</Label>
            <Select value={accountId || "none"} onValueChange={(v) => setAccountId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {(accounts ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Effective from</Label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Effective to (optional)</Label>
              <Input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Default for {type === "both" ? "all" : type}</Label>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name || create.isPending || update.isPending}>
            {editing ? "Save changes" : "Create tax rate"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
