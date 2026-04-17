import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCustomers, useUpsertCustomer } from "@/features/customers/hooks";
import { PageHeader } from "@/components/data/PageHeader";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Users, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const { data, isLoading } = useCustomers();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const upsert = useUpsertCustomer();

  const filtered = (data ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Customers"
        description="People and companies you bill."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New customer
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="max-w-sm"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} records</span>
      </div>

      <DataTable
        loading={isLoading}
        data={filtered}
        emptyState={
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No customers yet"
            description="Add your first customer to start invoicing."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> New customer
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
                to="/customers/$customerId"
                params={{ customerId: r.id }}
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
            <SheetTitle>New customer</SheetTitle>
            <SheetDescription>Add a customer to your records.</SheetDescription>
          </SheetHeader>
          <form
            id="customer-form"
            className="flex-1 space-y-4 overflow-y-auto py-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await upsert.mutateAsync({
                  name: String(fd.get("name") ?? ""),
                  email: (fd.get("email") as string) || null,
                  phone: (fd.get("phone") as string) || null,
                  tax_id: (fd.get("tax_id") as string) || null,
                  city: (fd.get("city") as string) || null,
                  country: (fd.get("country") as string) || null,
                  currency: (fd.get("currency") as string) || "USD",
                });
                toast.success("Customer created");
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
            <div className="space-y-1.5">
              <Label htmlFor="tax_id">Tax ID</Label>
              <Input name="tax_id" id="tax_id" />
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
              <Input name="currency" id="currency" defaultValue="USD" maxLength={3} />
            </div>
          </form>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="customer-form" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
