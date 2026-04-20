import { useAuth, type AppRole } from "@/lib/auth";

const hasAnyRole = (roles: AppRole[], allowed: AppRole[]) =>
  allowed.some((role) => roles.includes(role));

export interface FinancePermissions {
  canRecordCustomerPayments: boolean;
  canRecordSupplierPayments: boolean;
  canRecordPosSettlements: boolean;
  canIssueRefunds: boolean;
  canSendCustomerDocuments: boolean;
  canSendSupplierDocuments: boolean;
  canSendPosReceipts: boolean;
  canManageCollections: boolean;
  canManageCollectionPolicies: boolean;
  canManageDeliverySuppressions: boolean;
  canRetryDeliveryFailures: boolean;
  canManageDocumentTemplates: boolean;
  canOverridePosPrice: boolean;
  canBypassPosOverrideSetting: boolean;
  canReversePostedDocuments: boolean;
  canClosePeriods: boolean;
  canReopenPeriods: boolean;
  canChangeSensitiveSettings: boolean;
  canViewFinanceControls: boolean;
}

export function resolveFinancePermissions(roles: AppRole[]): FinancePermissions {
  const collectionRoles = ["owner", "accountant", "sales_manager"] as const;
  return {
    canRecordCustomerPayments: hasAnyRole(roles, ["owner", "accountant", "sales_manager"]),
    canRecordSupplierPayments: hasAnyRole(roles, ["owner", "accountant"]),
    canRecordPosSettlements: hasAnyRole(roles, [
      "owner",
      "accountant",
      "cashier",
      "store_manager",
      "sales_manager",
    ]),
    canIssueRefunds: hasAnyRole(roles, ["owner", "accountant", "sales_manager"]),
    canSendCustomerDocuments: hasAnyRole(roles, ["owner", "accountant", "sales_manager"]),
    canSendSupplierDocuments: hasAnyRole(roles, ["owner", "accountant"]),
    canSendPosReceipts: hasAnyRole(roles, [
      "owner",
      "accountant",
      "cashier",
      "store_manager",
      "sales_manager",
    ]),
    canManageCollections: hasAnyRole(roles, [...collectionRoles]),
    canManageCollectionPolicies: hasAnyRole(roles, ["owner", "accountant"]),
    canManageDeliverySuppressions: hasAnyRole(roles, [...collectionRoles]),
    canRetryDeliveryFailures: hasAnyRole(roles, [...collectionRoles]),
    canManageDocumentTemplates: hasAnyRole(roles, ["owner", "accountant"]),
    canOverridePosPrice: hasAnyRole(roles, [
      "owner",
      "accountant",
      "sales_manager",
      "store_manager",
    ]),
    canBypassPosOverrideSetting: hasAnyRole(roles, ["owner", "accountant"]),
    canReversePostedDocuments: hasAnyRole(roles, ["owner", "accountant"]),
    canClosePeriods: hasAnyRole(roles, ["owner", "accountant"]),
    canReopenPeriods: hasAnyRole(roles, ["owner"]),
    canChangeSensitiveSettings: hasAnyRole(roles, ["owner"]),
    canViewFinanceControls: hasAnyRole(roles, ["owner", "accountant"]),
  };
}

export function useFinancePermissions() {
  const { roles } = useAuth();
  return resolveFinancePermissions(roles);
}
