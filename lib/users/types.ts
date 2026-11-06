/** Tipe domain manajemen akun pengguna. */

import type { Role } from "@/lib/navigation";

export const ACCOUNT_STATUSES = ["Aktif", "Nonaktif", "Diundang"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const MANAGEABLE_ROLES: Role[] = [
  "admin",
  "hr_manager",
  "recruiter",
  "employee",
];

export type UserAccount = {
  id: string;
  fullName: string;
  email: string;
  role: Role | null;
  accountStatus: AccountStatus;
  employeeId: string | null;
  employeeName: string | null;
  lastSignInAt: string | null;
  createdAt: string;
};

export type RoleOption = {
  name: Role;
  description: string | null;
};

export type EmployeeOption = {
  id: string;
  fullName: string;
  position: string;
};

export type UserAccessEntry = {
  id: number;
  action: string;
  fromValue: string | null;
  toValue: string | null;
  reason: string | null;
  changedAt: string;
};

export type NewUserInput = {
  fullName: string;
  email: string;
  role: Role;
  employeeId: string | null;
};

export type UserUpdateInput = {
  fullName?: string;
  role?: Role;
  accountStatus?: AccountStatus;
  employeeId?: string | null;
};
