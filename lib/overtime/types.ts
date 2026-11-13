/** Tipe domain Lembur. */

import type { EmployeeStatus } from "@/lib/employees/types";
import type { HolidayEntry, WorkSchedule } from "@/lib/attendance/types";

export const OVERTIME_DAY_TYPES = ["workday", "restday", "holiday"] as const;
export type OvertimeDayType = (typeof OVERTIME_DAY_TYPES)[number];

export const OVERTIME_STATUSES = [
  "Menunggu",
  "Disetujui",
  "Ditolak",
  "Dibatalkan",
] as const;
export type OvertimeStatus = (typeof OVERTIME_STATUSES)[number];

export type OvertimeEmployee = {
  id: string;
  fullName: string;
  position: string;
  department: string;
  status: EmployeeStatus;
  joinedAt: string;
};

export type OvertimeHistoryEntry = {
  id: number;
  action:
    | "Diajukan"
    | "Disetujui"
    | "Ditolak"
    | "Dibatalkan Karyawan"
    | "Dibatalkan HR";
  fromStatus: OvertimeStatus | null;
  toStatus: OvertimeStatus | null;
  reason: string | null;
  actorName: string;
  actedAt: string;
};

export type OvertimeRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  employeeDepartment: string;
  requestDate: string;
  startTime: string;
  endTime: string;
  requestedMinutes: number;
  dayType: OvertimeDayType;
  workDescription: string;
  status: OvertimeStatus;
  approvedMinutes: number | null;
  equivalentMinutes: number | null;
  submittedAt: string;
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancellationKind: "Karyawan" | "HR" | null;
  cancellationReason: string | null;
  history: OvertimeHistoryEntry[];
};

export type OvertimeEmployeeData = {
  linked: boolean;
  employee: OvertimeEmployee | null;
  todayIso: string;
  month: string;
  requests: OvertimeRequest[];
  schedule: WorkSchedule | null;
  holidays: HolidayEntry[];
  /** Tanggal cuti/sakit/izin disetujui pada rentang pengajuan. */
  leaveDates: string[];
  monthlyApprovedMinutes: number;
  monthlyEquivalentMinutes: number;
  weekStart: string;
  weekEnd: string;
  weeklyUsedMinutes: number;
  weeklyRemainingMinutes: number;
};

export type OvertimeApprovalData = {
  todayIso: string;
  pending: OvertimeRequest[];
  /** Riwayat keputusan (tanpa Menunggu). */
  history: OvertimeRequest[];
  /** Menunggu + Disetujui, untuk total jam mingguan di drawer. */
  active: OvertimeRequest[];
};

export type OvertimeFilters = {
  q: string;
  department: string;
  dayType: string;
  from: string;
  to: string;
};

export type OvertimeInput = {
  requestDate: string;
  startTime: string;
  endTime: string;
  workDescription: string;
};

export type OvertimeFieldErrors = Record<string, string>;

export type OvertimeRecapEntry = {
  employeeId: string;
  requestDate: string;
  approvedMinutes: number;
  equivalentMinutes: number;
};

export type OvertimeDailyMarker = {
  employeeId: string;
  approvedMinutes: number;
  equivalentMinutes: number;
};
