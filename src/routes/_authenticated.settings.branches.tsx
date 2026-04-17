import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useBranches,
  useCreateBranch,
  useUpdateBranch,
  useDeleteBranch,
  useRegisters,
  useCreateRegister,
  useUpdateRegister,
  useDeleteRegister,
  type Branch,
  type PosRegister,
} from "@/features/branches/hooks";
import { useWarehouses } from "@/features/inventory/hooks";
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
import { Plus, Pencil, Trash2, Building2, Monitor } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/data/EmptyState";

export const Route = createFileRoute("/_authenticated/settings/branches")({
  component: BranchesPage,
});

function BranchesPage() {
  const { data: branches } = useBranches();
  const { data: registers } = useRegisters();
  const [branchOpen, setBranchOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editingRegister, setEditingRegister] = useState<PosRegister | null>(null);
  const delBranch = useDeleteBranch();
  const delRegister = useDeleteRegister();

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Branches</h2>
            <p className="text-xs text-muted-foreground">
              Physical outlets where you operate. Required for POS and cash sessions.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingBranch(null);
              setBranchOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> New branch
          </Button>
        </div>

        {!branches || branches.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No branches yet"
            description="Create your first branch to start using POS and cash sessions."
            action={
              <Button
                onClick={() => {
                  setEditingBranch(null);
                  setBranchOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> New branch
              </Button>
            }
          />
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="font-mono text-xs">{b.code}</TableCell>
                    <TableCell className="text-sm">{b.city ?? "—"}</TableCell>
                    <TableCell className="text-sm">{b.phone ?? "—"}</TableCell>
                    <TableCell>
                      {b.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingBranch(b);
                            setBranchOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (!confirm("Delete this branch?")) return;
                            try {
                              await delBranch.mutateAsync(b.id);
                              toast.success("Branch deleted");
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
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
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">POS Registers</h2>
            <p className="text-xs text-muted-foreground">
              Each register represents a physical or virtual checkout terminal.
            </p>
          </div>
          <Button
            size="sm"
            disabled={!branches || branches.length === 0}
            onClick={() => {
              setEditingRegister(null);
              setRegisterOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> New register
          </Button>
        </div>

        {!registers || registers.length === 0 ? (
          <EmptyState
            icon={<Monitor className="h-8 w-8" />}
            title="No registers yet"
            description={
              branches && branches.length > 0
                ? "Add a register to enable POS checkout for a branch."
                : "Create a branch first, then add a register to it."
            }
          />
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {registers.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="text-sm">
                      {(branches ?? []).find((b) => b.id === r.branch_id)?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {r.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingRegister(r);
                            setRegisterOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (!confirm("Delete this register?")) return;
                            try {
                              await delRegister.mutateAsync(r.id);
                              toast.success("Register deleted");
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
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
      </section>

      <BranchDrawer open={branchOpen} onOpenChange={setBranchOpen} editing={editingBranch} />
      <RegisterDrawer
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        editing={editingRegister}
        branches={branches ?? []}
      />
    </div>
  );
}

function BranchDrawer({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Branch | null;
}) {
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [active, setActive] = useState(true);

  const submit = async () => {
    try {
      const payload = {
        name,
        code,
        city: city || null,
        country: country || null,
        phone: phone || null,
        address_line1: address || null,
        is_active: active,
      };
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload });
        toast.success("Branch updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Branch created");
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
          setCode(editing?.code ?? "");
          setCity(editing?.city ?? "");
          setCountry(editing?.country ?? "");
          setPhone(editing?.phone ?? "");
          setAddress(editing?.address_line1 ?? "");
          setActive(editing?.is_active ?? true);
        }
        onOpenChange(v);
      }}
    >
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit branch" : "New branch"}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Main store" />
          </div>
          <div>
            <Label className="text-xs">Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MAIN" />
          </div>
          <div>
            <Label className="text-xs">Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Country</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm">Active</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name || !code}>
            {editing ? "Save" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RegisterDrawer({
  open,
  onOpenChange,
  editing,
  branches,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: PosRegister | null;
  branches: Branch[];
}) {
  const create = useCreateRegister();
  const update = useUpdateRegister();
  const { data: warehouses } = useWarehouses();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [active, setActive] = useState(true);

  const submit = async () => {
    try {
      const payload = {
        name,
        code,
        branch_id: branchId,
        default_warehouse_id: warehouseId || null,
        is_active: active,
      };
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload });
        toast.success("Register updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Register created");
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
          setCode(editing?.code ?? "");
          setBranchId(editing?.branch_id ?? branches[0]?.id ?? "");
          setWarehouseId(editing?.default_warehouse_id ?? "");
          setActive(editing?.is_active ?? true);
        }
        onOpenChange(v);
      }}
    >
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit register" : "New register"}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Counter 1" />
          </div>
          <div>
            <Label className="text-xs">Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="REG-01" />
          </div>
          <div>
            <Label className="text-xs">Branch</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Default warehouse (stock source)</Label>
            <Select value={warehouseId || "none"} onValueChange={(v) => setWarehouseId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {(warehouses ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm">Active</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name || !code || !branchId}>
            {editing ? "Save" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
