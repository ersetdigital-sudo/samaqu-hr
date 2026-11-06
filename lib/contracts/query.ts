/** Filter, pengurutan, pagination, dan ringkasan daftar kontrak. */

import {
  EXPIRING_SOON_DAYS,
  EXPIRING_WATCH_DAYS,
  type ContractDisplayStatus,
} from "@/lib/contracts/constants";
import { daysUntil, isExpiringWithin } from "@/lib/contracts/rules";
import type { ContractSummary } from "@/lib/contracts/types";
import type { EmploymentType } from "@/lib/employees/types";

export type ContractSort =
  | "end-asc"
  | "end-desc"
  | "name-asc"
  | "start-desc";

export type ContractFilters = {
  q: string;
  status: string;
  employmentType: string;
  department: string;
  endFrom: string;
  endTo: string;
  sort: ContractSort;
  page: number;
  pageSize: number;
};

export const DEFAULT_CONTRACT_FILTERS: ContractFilters = {
  q: "",
  status: "Semua",
  employmentType: "Semua",
  department: "Semua",
  endFrom: "",
  endTo: "",
  sort: "end-asc",
  page: 1,
  pageSize: 8,
};

export const CONTRACT_SORT_LABELS: { value: ContractSort; label: string }[] = [
  { value: "end-asc", label: "Berakhir terdekat" },
  { value: "end-desc", label: "Berakhir terjauh" },
  { value: "name-asc", label: "Nama A–Z" },
  { value: "start-desc", label: "Mulai terbaru" },
];

const matches = (value: string, filter: string) =>
  filter === "Semua" || value === filter;

const inEndRange = (
  contract: ContractSummary,
  from: string,
  to: string
): boolean => {
  if (!from && !to) return true;
  if (!contract.endDate) return false;
  if (from && contract.endDate < from) return false;
  if (to && contract.endDate > to) return false;
  return true;
};

export type ContractResult = {
  rows: ContractSummary[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
};

export function filterContracts(
  contracts: ContractSummary[],
  filters: ContractFilters,
  now: Date = new Date()
): ContractResult {
  const term = filters.q.trim().toLowerCase();

  const filtered = contracts.filter((contract) => {
    const haystack =
      `${contract.employeeName} ${contract.employeeId} ${contract.contractNumber}`.toLowerCase();
    // Status tampilan sudah dihitung server; tidak dihitung ulang di UI.
    const displayStatus: ContractDisplayStatus = contract.displayStatus;

    return (
      (!term || haystack.includes(term)) &&
      matches(displayStatus, filters.status) &&
      matches(contract.employmentType, filters.employmentType) &&
      matches(contract.department, filters.department) &&
      inEndRange(contract, filters.endFrom, filters.endTo)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case "name-asc":
        return a.employeeName.localeCompare(b.employeeName, "id");
      case "start-desc":
        return b.startDate.localeCompare(a.startDate);
      case "end-desc":
        if (!a.endDate) return -1;
        if (!b.endDate) return 1;
        return b.endDate.localeCompare(a.endDate);
      case "end-asc":
      default:
        // Kontrak tanpa tanggal berakhir (Tetap) selalu di bawah.
        if (!a.endDate) return 1;
        if (!b.endDate) return -1;
        return a.endDate.localeCompare(b.endDate);
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

export type ContractStats = {
  active: number;
  expiring30: number;
  expiring90: number;
  ended: number;
  employmentCounts: Record<EmploymentType, number>;
};

export function buildContractStats(
  contracts: ContractSummary[],
  employees: { employmentType: EmploymentType }[],
  now: Date = new Date()
): ContractStats {
  const employmentCounts = {
    Tetap: 0,
    Kontrak: 0,
    Magang: 0,
    Harian: 0,
  } as Record<EmploymentType, number>;

  employees.forEach((employee) => {
    employmentCounts[employee.employmentType] += 1;
  });

  return {
    active: contracts.filter((contract) => contract.status === "Aktif").length,
    expiring30: contracts.filter((contract) =>
      isExpiringWithin(contract, EXPIRING_SOON_DAYS, now)
    ).length,
    expiring90: contracts.filter((contract) =>
      isExpiringWithin(contract, EXPIRING_WATCH_DAYS, now)
    ).length,
    ended: contracts.filter(
      (contract) =>
        contract.status === "Berakhir" ||
        (contract.status === "Aktif" &&
          contract.endDate !== null &&
          daysUntil(contract.endDate, now) < 0)
    ).length,
    employmentCounts,
  };
}

export function uniqueContractValues(
  contracts: ContractSummary[],
  key: "department" | "employmentType"
): string[] {
  return [...new Set(contracts.map((contract) => contract[key]))].sort((a, b) =>
    a.localeCompare(b, "id")
  );
}
