/**
 * Filter, pencarian, pengurutan, dan pagination Direktori Karyawan.
 * Fungsi murni supaya mudah diuji dan dipakai ulang saat data pindah ke API.
 */

import { parseIsoDate } from "@/lib/employees/format";
import type {
  EmployeeDirectoryStats,
  EmployeeSummary,
} from "@/lib/employees/types";

export type DirectorySort =
  | "name-asc"
  | "name-desc"
  | "joined-desc"
  | "joined-asc";

export type DirectoryFilters = {
  q: string;
  department: string;
  status: string;
  location: string;
  employmentType: string;
  sort: DirectorySort;
  page: number;
  pageSize: number;
};

export const DEFAULT_FILTERS: DirectoryFilters = {
  q: "",
  department: "Semua",
  status: "Semua",
  location: "Semua",
  employmentType: "Semua",
  sort: "name-asc",
  page: 1,
  pageSize: 8,
};

export type DirectoryResult = {
  rows: EmployeeSummary[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
};

const matches = (value: string, filter: string) =>
  filter === "Semua" || value === filter;

export function filterEmployees(
  employees: EmployeeSummary[],
  filters: DirectoryFilters
): DirectoryResult {
  const term = filters.q.trim().toLowerCase();

  const filtered = employees.filter((employee) => {
    const haystack = `${employee.fullName} ${employee.id} ${employee.position}`.toLowerCase();
    return (
      (!term || haystack.includes(term)) &&
      matches(employee.department, filters.department) &&
      matches(employee.status, filters.status) &&
      matches(employee.location, filters.location) &&
      matches(employee.employmentType, filters.employmentType)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case "name-desc":
        return b.fullName.localeCompare(a.fullName, "id");
      case "joined-desc":
        return b.joinedAt.localeCompare(a.joinedAt);
      case "joined-asc":
        return a.joinedAt.localeCompare(b.joinedAt);
      case "name-asc":
      default:
        return a.fullName.localeCompare(b.fullName, "id");
    }
  });

  const pageSize = Math.max(1, filters.pageSize);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const start = (page - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  return {
    rows,
    total: sorted.length,
    page,
    pageCount,
    from: sorted.length === 0 ? 0 : start + 1,
    to: start + rows.length,
  };
}

const CUTOFF_DAYS = 30;

export function buildDirectoryStats(
  employees: EmployeeSummary[],
  now: Date = new Date()
): EmployeeDirectoryStats {
  const cutoff = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - CUTOFF_DAYS
  );

  const joinedWithinCutoff = (iso: string) => {
    const date = parseIsoDate(iso);
    return date !== null && date.getTime() >= cutoff.getTime();
  };

  return {
    totalActive: employees.filter((employee) => employee.status === "Aktif")
      .length,
    newLast30Days: employees.filter(
      (employee) =>
        employee.status !== "Nonaktif" && joinedWithinCutoff(employee.joinedAt)
    ).length,
    probation: employees.filter((employee) => employee.status === "Probation")
      .length,
    inactive: employees.filter((employee) => employee.status === "Nonaktif")
      .length,
  };
}

/** Opsi filter dari data yang benar-benar ada. */
export function uniqueOptions(
  employees: EmployeeSummary[],
  key: "department" | "location" | "employmentType"
): string[] {
  return [...new Set(employees.map((employee) => employee[key]))].sort((a, b) =>
    a.localeCompare(b, "id")
  );
}
