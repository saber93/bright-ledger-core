import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSuppliers, useUpsertSupplier } from "@/features/suppliers/hooks";
import { PageHeader } from "@/components/data/PageHeader";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Truck, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({
  component: SuppliersPage,
});

function SuppliersPage() {
  const { data, isLoading } = useSuppliers();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const upsert = useUpsertSupplier();
  const filtered = (data ?? []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Vendors you receive bills from."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New supplier
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="max-w-sm"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} records</span>
      </div>

      <DataTable
        loading={isLoading}
        data={filtered}
        emptyState={
          <EmptyState
            icon={<Truck className="h-5 w-5" />}
            title="No suppliers yet"
            description="Add your first supplier to start recording bills."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> New supplier
              </Button>
            }
          />
        }
        columns={[
          {
            key: "name",
            header: "Name",
            cell: (r) => (
              <Link
                to="/suppliers"
                className="font-medium text-foreground hover:text-primary"
              >
                {r.name}
              </Link>
            ),
          },
          { key: "email", header: "Email", cell: (r) => r.email ?? "—" },
          { key: "phone", header: "Phone", cell: (r) => r.phone ?? "—" },
          { key: "city", header: "Location", cell: (r) => [r.city, r.country].filter(Boolean).join(", ") || "—" },
          { key: "currency", header: "Currency", cell: (r) => r.currency, align: "right" },
        ]}
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New supplier</SheetTitle>
            <SheetDescription>Add a supplier to your records.</SheetDescription>
          </SheetHeader>
          <form
            id="supplier-form"
            className="flex-1 space-y-4 overflow-y-auto py-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await upsert.mutateAsync({
                  name: String(fd.get("name") ?? ""),
                  email: (fd.get("email") as string) || null,
                  phone: (fd.get("phone") as string) || null,
                  city: (fd.get("city") as string) || null,
                  country: (fd.get("country") as string) || null,
                  currency: (fd.get("currency") as string) || "USD",
                });
                toast.success("Supplier created");
                setOpen(false);
              } catch (err) {
                const e = err as { message?: string };
                toast.error(e.message ?? "Failed");
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input name="name" id="name" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input name="email" id="email" type="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input name="phone" id="phone" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input name="city" id="city" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <Input name="country" id="country" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input name="currency" id="currency" defaultValue="USD" />
            </div>
          </form>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="supplier-form" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
