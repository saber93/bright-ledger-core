import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/data/PageHeader";
import { EmptyState } from "@/components/data/EmptyState";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales")({
  component: () => (
    <div>
      <PageHeader title="Sales Orders" description="Quotations, orders, and fulfillment." />
      <EmptyState
        icon={<ClipboardList className="h-5 w-5" />}
        title="Sales Orders coming soon"
        description="Quotations → orders → delivery → invoice. The schema is ready; the UI is next."
      />
    </div>
  ),
});
