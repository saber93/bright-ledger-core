import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  icon,
  trend,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: { value: string; positive?: boolean };
  accent?: "primary" | "success" | "warning" | "danger" | "info";
}) {
  const accentColor: Record<NonNullable<typeof accent>, string> = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning-foreground bg-warning/15",
    danger: "text-destructive bg-destructive/10",
    info: "text-info bg-info/10",
  };

  return (
    <div className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-elevated)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 truncate font-mono text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
          {(hint || trend) && (
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              {trend && (
                <span
                  className={cn(
                    "font-medium",
                    trend.positive ? "text-success" : "text-destructive",
                  )}
                >
                  {trend.positive ? "↑" : "↓"} {trend.value}
                </span>
              )}
              {hint && <span className="text-muted-foreground">{hint}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              accentColor[accent ?? "primary"],
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
