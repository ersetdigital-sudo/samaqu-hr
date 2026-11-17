import { AUDIT_MODULES, type AuditModuleOption } from "@/lib/audit/types";

export const AUDIT_PAGE_SIZE = 50;

export function auditModuleOptions(isAdmin: boolean): AuditModuleOption[] {
  return AUDIT_MODULES.filter((option) => isAdmin || !option.adminOnly);
}

export function auditPagination(total: number, page: number) {
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : (current - 1) * AUDIT_PAGE_SIZE + 1;
  const to = total === 0 ? 0 : Math.min(current * AUDIT_PAGE_SIZE, total);
  return { page: current, pageCount, from, to };
}
