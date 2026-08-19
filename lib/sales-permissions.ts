import type { CrmTeamRole, SalesPermission } from "@/lib/types";

export const defaultSalesPermissions: SalesPermission[] = ["crm_today", "lead_details", "follow_ups", "sales_sessions"];
export const defaultCrmTeamRoles: CrmTeamRole[] = ["sales", "observer"];
const salesRolePermissions: SalesPermission[] = ["crm_today", "lead_details", "follow_ups", "crm_analytics"];
const observerRolePermissions: SalesPermission[] = ["sales_sessions"];

export const salesPermissionOptions: Array<{ key: SalesPermission; label: string; description: string }> = [
  { key: "crm_today", label: "CRM Today", description: "Daily assigned lead queue and priority actions." },
  { key: "lead_details", label: "Lead Details", description: "Open assigned lead profiles and update activity." },
  { key: "follow_ups", label: "Follow-ups", description: "View and complete assigned follow-up tasks." },
  { key: "sales_sessions", label: "Sales Sessions", description: "Open sessions and complete participant scorecards." },
  { key: "crm_analytics", label: "CRM Analytics", description: "View analytics calculated from assigned leads." }
];

export function normalizeSalesPermissions(value: unknown): SalesPermission[] {
  if (!Array.isArray(value)) return [...defaultSalesPermissions];
  const allowed = new Set(salesPermissionOptions.map((option) => option.key));
  return value.filter((item): item is SalesPermission => allowed.has(item as SalesPermission));
}

export function normalizeCrmTeamRoles(value: unknown): CrmTeamRole[] {
  if (!Array.isArray(value)) return [...defaultCrmTeamRoles];
  return value.filter((item): item is CrmTeamRole => item === "sales" || item === "observer");
}

export function permissionsForRoles(rolesValue: unknown): SalesPermission[] {
  const roles = normalizeCrmTeamRoles(rolesValue);
  return [...new Set([...(roles.includes("sales") ? salesRolePermissions : []), ...(roles.includes("observer") ? observerRolePermissions : [])])];
}

export function permissionsAllowedForRoles(permissionsValue: unknown, rolesValue: unknown): SalesPermission[] {
  const allowed = new Set(permissionsForRoles(rolesValue));
  return normalizeSalesPermissions(permissionsValue).filter((permission) => allowed.has(permission));
}

export function permissionForPath(pathname: string): SalesPermission | null {
  if (pathname === "/crm/today") return "crm_today";
  if (pathname.startsWith("/crm/leads/")) return "lead_details";
  if (pathname === "/crm/follow-ups") return "follow_ups";
  if (pathname === "/crm/sessions" || pathname.startsWith("/api/crm/sales-sessions")) return "sales_sessions";
  if (pathname === "/crm/analytics") return "crm_analytics";
  return null;
}
