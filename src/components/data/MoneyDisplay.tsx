import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

export function MoneyDisplay({
  value,
  currency = "USD",
  className,
  muted = false,
  negative = false,
}: {
  value: number | string | null | undefined;
  currency?: string;
  className?: string;
  muted?: boolean;
  negative?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        muted && "text-muted-foreground",
        negative && "text-destructive",
        className,
      )}
    >
      {formatMoney(value, currency)}
    </span>
  );
}
