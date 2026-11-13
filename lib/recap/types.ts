/** Tipe domain Rekap Kehadiran (Attendance Tahap C). */

import type {
  AttendanceDay,
  AttendanceRecord,
  HolidayEntry,
  WorkSchedule,
} from "@/lib/attendance/types";
import type { EmployeeStatus } from "@/lib/employees/types";
import type { LeaveDayStatus } from "@/lib/leave/types";
import type { OvertimeRecapEntry } from "@/lib/overtime/types";

export type RecapSettings = {
  periodStartDay: number;
  updatedAt: string | null;
  updatedByName: string | null;
};

export type RecapPeriod = {
  month: string;
  from: string;
  to: string;
  startDay: number;
};

export type RecapEmployee = {
  id: string;
  fullName: string;
  department: string;
  position: string;
  status: EmployeeStatus;
  joinedAt: string;
  /** Hari terakhir yang masih dihitung untuk karyawan Nonaktif. */
  activeEndDate: string | null;
  /** False bila tanggal Nonaktif tidak ditemukan di riwayat status. */
  inactiveDateKnown: boolean;
};

export type RecapLeave = {
  employeeId: string;
  startDate: string;
  endDate: string;
  status: LeaveDayStatus;
};

export type RecapRow = {
  employee: RecapEmployee;
  workdays: number;
  present: number;
  lateCount: number;
  lateMinutes: number;
  earlyCount: number;
  earlyMinutes: number;
  missingCheckout: number;
  alfa: number;
  cuti: number;
  sakit: number;
  izin: number;
  workMinutes: number;
  attendancePercent: number;
  problemDays: number;
  overtimeApprovedMinutes: number;
  overtimeEquivalentMinutes: number;
  days: AttendanceDay[];
};

export type RecapFilters = {
  q: string;
  department: string;
  status: string;
};

export type RecapSortKey =
  | "employee"
  | "workdays"
  | "present"
  | "late"
  | "early"
  | "missing"
  | "alfa"
  | "cuti"
  | "sakit"
  | "izin"
  | "workMinutes"
  | "attendancePercent"
  | "overtime";

export type RecapSort = {
  key: RecapSortKey;
  direction: "asc" | "desc";
};

export type RecapData = {
  todayIso: string;
  settings: RecapSettings;
  period: RecapPeriod;
  rows: RecapRow[];
};

export type MyRecapData = {
  linked: boolean;
  employee: RecapEmployee | null;
  row: RecapRow | null;
  todayIso: string;
  settings: RecapSettings;
  period: RecapPeriod;
};

export type RecapInput = {
  employees: RecapEmployee[];
  period: RecapPeriod;
  todayIso: string;
  schedules: WorkSchedule[];
  holidays: HolidayEntry[];
  records: AttendanceRecord[];
  leaves: RecapLeave[];
  overtime: OvertimeRecapEntry[];
};
