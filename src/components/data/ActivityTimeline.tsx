import type { ReactNode } from "react";
import { formatDateTime } from "@/lib/format";

export interface TimelineItem {
  id: string;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  timestamp: string | Date;
  actor?: string;
}

export function ActivityTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity yet.</p>
    );
  }
  return (
    <ol className="relative space-y-5 border-l border-border pl-6">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-primary" />
          <div className="text-sm font-medium text-foreground">{item.title}</div>
          {item.description && (
            <div className="mt-0.5 text-sm text-muted-foreground">{item.description}</div>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(item.timestamp)}
            {item.actor && <> · {item.actor}</>}
          </div>
        </li>
      ))}
    </ol>
  );
}
