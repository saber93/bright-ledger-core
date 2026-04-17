import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  width?: string;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  loading,
  emptyState,
  onRowClick,
  footer,
}: {
  columns: Column<T>[];
  data: T[] | undefined;
  loading?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  footer?: ReactNode;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(
                    "h-10 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    !c.align && "text-left",
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b transition-colors last:border-b-0",
                  onRowClick && "cursor-pointer hover:bg-accent/50",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 py-2.5 text-foreground",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot className="border-t bg-muted/30">{footer}</tfoot>}
        </table>
      </div>
    </div>
  );
}
