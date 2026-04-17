import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatMoney } from "@/lib/format";
import { usePosOrders } from "@/features/pos/hooks";
import { useAuth } from "@/lib/auth";
import { useCompanySettings } from "@/features/settings/hooks";

export const Route = createFileRoute("/_authenticated/pos-orders")({
  component: PosOrdersPage,
});

function PosOrdersPage() {
  const { company } = useAuth();
  const { data: settings } = useCompanySettings();
  const { data = [], isLoading } = usePosOrders(200);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(
    () =>
      data.filter((o) => {
        if (statusFilter !== "all" && o.status !== statusFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          o.order_number.toLowerCase().includes(q) ||
          (o.customers?.name ?? "").toLowerCase().includes(q)
        );
      }),
    [data, search, statusFilter],
  );

  if (settings && !settings.pos_enabled) {
    return (
      <div>
        <PageHeader title="POS Orders" description="Module disabled" />
        <EmptyState
          icon={<Wallet className="h-8 w-8" />}
          title="POS is disabled"
          description="Enable Point of Sale in Settings → Modules & Features."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="POS Orders"
        description="Counter sales rung up at the point of sale."
        actions={
          <Button asChild>
            <Link to="/pos">Open POS</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by order # or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs"
        />
        <div className="flex gap-1">
          {["all", "completed", "held", "refunded", "partially_refunded", "cancelled"].map(
            (s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
                className="capitalize"
              >
                {s.replace("_", " ")}
              </Button>
            ),
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-8 w-8" />}
              title="No POS orders yet"
              description="Sales rung up at the POS terminal will appear here."
            />
          ) : (
            <div className="divide-y">
              {filtered.map((o) => (
                <Link
                  key={o.id}
                  to="/pos-orders/$orderId"
                  params={{ orderId: o.id }}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {o.order_number}
                      <Badge
                        variant={o.status === "completed" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {o.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.customers?.name ?? "Walk-in"} ·{" "}
                      {o.pos_registers?.name ?? "—"} ·{" "}
                      {formatDateTime(o.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {formatMoney(Number(o.total), company?.currency)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {o.invoice_id ? "Invoiced" : "—"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
