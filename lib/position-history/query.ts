/** Filter, ringkasan, dan pagination riwayat perubahan posisi. */

import { DEPARTMENTS } from "@/lib/employees/types";
import type {
  PositionChangeType,
  PositionHistoryEntry,
} from "@/lib/position-history/types";
import { POSITION_CHANGE_TYPES } from "@/lib/position-history/types";

export type PositionHistoryFilters = {
  q: string;
  changeType: "Semua" | PositionChangeType;
  department: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
};

export const DEFAULT_POSITION_HISTORY_FILTERS: PositionHistoryFilters = {
  q: "",
  changeType: "Semua",
  department: "Semua",
  from: "",
  to: "",
  page: 1,
  pageSize: 8,
};

export const POSITION_CHANGE_TYPE_FILTERS: ("Semua" | PositionChangeType)[] = [
  "Semua",
  ...POSITION_CHANGE_TYPES,
];

export type PositionHistoryResult = {
  rows: PositionHistoryEntry[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
};

export function filterPositionHistory(
  history: PositionHistoryEntry[],
  filters: PositionHistoryFilters
): PositionHistoryResult {
  const term = filters.q.trim().toLowerCase();

  const filtered = history.filter((entry) => {
    const haystack = `${entry.employeeName} ${entry.employeeId}`.toLowerCase();
    return (
      (!term || haystack.includes(term)) &&
      (filters.changeType === "Semua" ||
        entry.changeType === filters.changeType) &&
      (filters.department === "Semua" ||
        entry.newDepartment === filters.department) &&
      (!filters.from || entry.effectiveDate >= filters.from) &&
      (!filters.to || entry.effectiveDate <= filters.to)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const byDate = b.effectiveDate.localeCompare(a.effectiveDate);
    if (byDate !== 0) return byDate;
    return b.recordedAt.localeCompare(a.recordedAt);
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

const isoDaysAgo = (todayIso: string, days: number): string => {
  const date = new Date(`${todayIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

export type PositionHistoryStats = {
  promotions: number;
  mutations: number;
  demotions: number;
};

export function buildPositionHistoryStats(
  history: PositionHistoryEntry[],
  todayIso: string
): PositionHistoryStats {
  const cutoff = isoDaysAgo(todayIso, 90);
  const recent = history.filter(
    (entry) =>
      entry.effectiveDate >= cutoff && entry.effectiveDate <= todayIso
  );

  return {
    promotions: recent.filter((entry) => entry.changeType === "Promosi")
      .length,
    mutations: recent.filter((entry) => entry.changeType === "Mutasi").length,
    demotions: recent.filter((entry) => entry.changeType === "Demosi").length,
  };
}

export function positionDepartmentOptions(
  history: PositionHistoryEntry[]
): string[] {
  const values = new Set<string>(DEPARTMENTS);
  history.forEach((entry) => values.add(entry.newDepartment));
  return [...values].sort((a, b) => a.localeCompare(b, "id"));
}

export const positionChangeTone = (type: PositionChangeType): string =>
  type === "Promosi" ? "t-ok" : type === "Mutasi" ? "t-info" : "t-warn";
