/** Filter dan ringkasan tampilan Cuti & Izin. */

import { leaveRangesOverlap } from "@/lib/leave/rules";
import type {
  LeaveBalance,
  LeaveCalendarEntry,
  LeaveRequest,
} from "@/lib/leave/types";

export type LeaveApprovalFilters = {
  q: string;
  type: string;
  department: string;
  from: string;
  to: string;
};

export const DEFAULT_LEAVE_APPROVAL_FILTERS: LeaveApprovalFilters = {
  q: "",
  type: "Semua",
  department: "Semua",
  from: "",
  to: "",
};

export function filterLeaveRequests(
  requests: LeaveRequest[],
  filters: LeaveApprovalFilters
): LeaveRequest[] {
  const term = filters.q.trim().toLowerCase();

  return requests.filter((request) => {
    const haystack =
      `${request.employeeName} ${request.employeeId}`.toLowerCase();
    const matchesRange =
      (!filters.from || request.endDate >= filters.from) &&
      (!filters.to || request.startDate <= filters.to);

    return (
      (!term || haystack.includes(term)) &&
      (filters.type === "Semua" || request.leaveTypeCode === filters.type) &&
      (filters.department === "Semua" ||
        request.employeeDepartment === filters.department) &&
      matchesRange
    );
  });
}

export function leaveDepartmentOptions(
  balances: LeaveBalance[],
  activeLeaves: LeaveCalendarEntry[]
): string[] {
  return [
    ...new Set([
      ...balances.map((balance) => balance.department),
      ...activeLeaves.map((entry) => entry.employeeDepartment),
    ]),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "id"));
}

export function teamOverlapsFor(
  request: LeaveRequest,
  activeLeaves: LeaveCalendarEntry[]
): LeaveCalendarEntry[] {
  return activeLeaves
    .filter(
      (entry) =>
        entry.id !== request.id &&
        entry.employeeId !== request.employeeId &&
        entry.employeeDepartment === request.employeeDepartment &&
        leaveRangesOverlap(
          request.startDate,
          request.endDate,
          entry.startDate,
          entry.endDate
        )
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export type LeaveApprovalStats = {
  pending: number;
  onLeaveToday: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
};

export function buildLeaveApprovalStats(
  pending: LeaveRequest[],
  history: LeaveRequest[],
  activeLeaves: LeaveCalendarEntry[],
  todayIso: string
): LeaveApprovalStats {
  const month = todayIso.slice(0, 7);
  return {
    pending: pending.length,
    onLeaveToday: new Set(
      activeLeaves
        .filter(
          (entry) =>
            entry.status === "Disetujui" &&
            entry.startDate <= todayIso &&
            entry.endDate >= todayIso
        )
        .map((entry) => entry.employeeId)
    ).size,
    approvedThisMonth: history.filter(
      (request) =>
        request.status === "Disetujui" &&
        request.decidedAt?.slice(0, 7) === month
    ).length,
    rejectedThisMonth: history.filter(
      (request) =>
        request.status === "Ditolak" &&
        request.decidedAt?.slice(0, 7) === month
    ).length,
  };
}
