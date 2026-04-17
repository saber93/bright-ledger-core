import type { ReactNode } from "react";
import { useCompanySettings } from "@/features/settings/hooks";

type Flag =
  | "accounting_enabled"
  | "inventory_enabled"
  | "stock_tracking_enabled"
  | "online_store_enabled"
  | "online_payments_enabled";

export function ModuleGate({
  flag,
  children,
  fallback = null,
}: {
  flag: Flag;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { data } = useCompanySettings();
  if (!data) return null;
  return data[flag] ? <>{children}</> : <>{fallback}</>;
}

export function useModuleEnabled(flag: Flag): boolean {
  const { data } = useCompanySettings();
  return Boolean(data?.[flag]);
}
