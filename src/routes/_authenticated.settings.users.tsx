import { createFileRoute } from "@tanstack/react-router";
import { useCompanyMembers } from "@/features/settings/hooks";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatDate } from "@/lib/format";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/users")({
  component: UsersPage,
});

function UsersPage() {
  const { data, isLoading } = useCompanyMembers();

  return (
    <DataTable
      loading={isLoading}
      data={data}
      emptyState={
        <EmptyState icon={<Users className="h-5 w-5" />} title="No teammates yet" />
      }
      columns={[
        {
          key: "user",
          header: "Member",
          cell: (m) => (
            <div className="flex items-center gap-2.5">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {initials(m.display_name)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{m.display_name}</span>
            </div>
          ),
        },
        {
          key: "roles",
          header: "Roles",
          cell: (m) => (
            <div className="flex flex-wrap gap-1">
              {m.roles.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  {r.replace("_", " ")}
                </span>
              ))}
            </div>
          ),
        },
        { key: "joined", header: "Joined", cell: (m) => formatDate(m.joined_at) },
        {
          key: "status",
          header: "Status",
          align: "right",
          cell: (m) => (
            <span className="text-xs text-muted-foreground">
              {m.is_active ? "Active" : "Inactive"}
            </span>
          ),
        },
      ]}
    />
  );
}
