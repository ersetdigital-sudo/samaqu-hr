import {
  NAV_GROUPS,
  isSubItemLive,
  isSuperuser,
  type Role,
} from "@/lib/navigation";

export const ACCESS_ROLES: Role[] = [
  "admin",
  "hr_manager",
  "recruiter",
  "employee",
];

export const ACCESS_ROLE_LABELS: Record<Role, string> = {
  admin: "Admin (superuser)",
  hr_manager: "HR Manager",
  recruiter: "Recruiter",
  employee: "Employee",
};

export type AccessMatrixRow = {
  id: string;
  label: string;
  level: 0 | 1;
  planned: boolean;
  roles: Record<Role, boolean>;
};

export type AccessMatrixGroup = {
  id: string;
  label: string;
  rows: AccessMatrixRow[];
};

const roleMap = (allowed: (role: Role) => boolean): Record<Role, boolean> =>
  Object.fromEntries(
    ACCESS_ROLES.map((role) => [role, isSuperuser(role) || allowed(role)])
  ) as Record<Role, boolean>;

export function buildAccessMatrix(): AccessMatrixGroup[] {
  return NAV_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    rows: group.modules.flatMap((module) => {
      const moduleRow: AccessMatrixRow = {
        id: `module-${module.id}`,
        label: module.label,
        level: 0,
        planned: false,
        roles: roleMap((role) => module.roles.includes(role)),
      };
      const itemRows: AccessMatrixRow[] = module.items.map((item) => ({
        id: `item-${module.id}-${item.id}`,
        label: item.label,
        level: 1,
        planned: !isSubItemLive(module, item),
        roles: roleMap((role) =>
          (item.roles ?? module.roles).includes(role)
        ),
      }));
      return [moduleRow, ...itemRows];
    }),
  }));
}
