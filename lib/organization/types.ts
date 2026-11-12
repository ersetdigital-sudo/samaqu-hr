/** Tipe domain Struktur Organisasi (read-only). */

import type { EmployeeStatus } from "@/lib/employees/types";

export type OrganizationEmployee = {
  id: string;
  fullName: string;
  position: string;
  department: string;
  status: EmployeeStatus;
  managerId: string | null;
};

export type OrganizationIssue = "missing-manager" | "cycle";

export type OrganizationNode = OrganizationEmployee & {
  children: OrganizationNode[];
  /** Akar = 0. */
  depth: number;
  /** Jumlah bawahan yang tampil langsung di bawah node ini. */
  directReports: number;
  issue: OrganizationIssue | null;
  /** Nama atasan yang tampil di bagan (setelah node nonaktif dilewati). */
  managerName: string | null;
};

export type DepartmentGroup = {
  department: string;
  employees: OrganizationEmployee[];
  count: number;
};

export type OrganizationSummary = {
  total: number;
  departments: number;
  /** Root = tingkat 1. */
  deepestLevel: number;
};

export type OrganizationModel = {
  forest: OrganizationNode[];
  departmentGroups: DepartmentGroup[];
  summary: OrganizationSummary;
};
