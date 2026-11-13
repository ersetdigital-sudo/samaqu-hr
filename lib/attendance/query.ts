/** Filter, ringkasan, dan pembentukan baris kehadiran harian. */

import {
  attendanceDayLabel,
  computeAttendanceDay,
} from "@/lib/attendance/rules";
import type {
  AttendanceCorrection,
  AttendanceDailyRow,
  AttendanceEmployee,
  AttendanceLeaveStatus,
  AttendanceRecord,
  AttendanceStatus,
  HolidayEntry,
  WorkSchedule,
} from "@/lib/attendance/types";
import type { OvertimeDailyMarker } from "@/lib/overtime/types";

export const ATTENDANCE_STATUS_VALUES: AttendanceStatus[] = [
  "Hadir",
  "Terlambat",
  "Pulang Cepat",
  "Belum Check-out",
  "Lupa Check-out",
  "Belum Masuk",
  "Alfa",
  "Cuti",
  "Sakit",
  "Izin",
];

export type AttendanceDailyFilters = {
  q: string;
  department: string;
  status: string;
};

export const DEFAULT_ATTENDANCE_DAILY_FILTERS: AttendanceDailyFilters = {
  q: "",
  department: "Semua",
  status: "Semua",
};

export const ATTENDANCE_STATUS_FILTERS = [
  "Semua",
  ...ATTENDANCE_STATUS_VALUES,
  "Libur",
  "Non-kerja",
];

export function buildAttendanceDailyRows({
  date,
  todayIso,
  employees,
  attendance,
  corrections,
  schedule,
  holiday,
  leaveStatuses = [],
  overtimeStatuses = [],
}: {
  date: string;
  todayIso: string;
  employees: AttendanceEmployee[];
  attendance: AttendanceRecord[];
  corrections: AttendanceCorrection[];
  schedule: WorkSchedule | null;
  holiday: HolidayEntry | null;
  leaveStatuses?: AttendanceLeaveStatus[];
  overtimeStatuses?: OvertimeDailyMarker[];
}): AttendanceDailyRow[] {
  const recordByEmployee = new Map(
    attendance.map((record) => [record.employeeId, record])
  );
  const leaveByEmployee = new Map(
    leaveStatuses.map((entry) => [entry.employeeId, entry.status])
  );
  const overtimeByEmployee = new Map(
    overtimeStatuses.map((entry) => [entry.employeeId, entry])
  );
  const correctionsByEmployee = new Map<string, AttendanceCorrection[]>();

  for (const correction of corrections) {
    const list = correctionsByEmployee.get(correction.employeeId) ?? [];
    list.push(correction);
    correctionsByEmployee.set(correction.employeeId, list);
  }

  return employees.map((employee) => ({
    employee,
    day: computeAttendanceDay({
      date,
      todayIso,
      schedule,
      holidayName: holiday?.name ?? null,
      record: recordByEmployee.get(employee.id) ?? null,
      joinedAt: employee.joinedAt,
      leaveStatus: leaveByEmployee.get(employee.id) ?? null,
    }),
    corrections: correctionsByEmployee.get(employee.id) ?? [],
    overtimeApprovedMinutes:
      overtimeByEmployee.get(employee.id)?.approvedMinutes ?? 0,
    overtimeEquivalentMinutes:
      overtimeByEmployee.get(employee.id)?.equivalentMinutes ?? 0,
  }));
}

export function filterAttendanceDailyRows(
  rows: AttendanceDailyRow[],
  filters: AttendanceDailyFilters
): AttendanceDailyRow[] {
  const term = filters.q.trim().toLowerCase();

  return rows.filter((row) => {
    const haystack =
      `${row.employee.fullName} ${row.employee.id}`.toLowerCase();
    return (
      (!term || haystack.includes(term)) &&
      (filters.department === "Semua" ||
        row.employee.department === filters.department) &&
      (filters.status === "Semua" ||
        attendanceDayLabel(row.day) === filters.status)
    );
  });
}

export type AttendanceDailySummary = {
  hadir: number;
  terlambat: number;
  belumMasuk: number;
  alfa: number;
  belumCheckOut: number;
  leave: number;
};

export function buildAttendanceDailySummary(
  rows: AttendanceDailyRow[]
): AttendanceDailySummary {
  return {
    hadir: rows.filter((row) => row.day.status === "Hadir").length,
    terlambat: rows.filter((row) => row.day.status === "Terlambat").length,
    belumMasuk: rows.filter((row) => row.day.status === "Belum Masuk").length,
    alfa: rows.filter((row) => row.day.status === "Alfa").length,
    belumCheckOut: rows.filter(
      (row) =>
        row.day.status === "Belum Check-out" ||
        row.day.status === "Lupa Check-out"
    ).length,
    leave: rows.filter(
      (row) =>
        row.day.status === "Cuti" ||
        row.day.status === "Sakit" ||
        row.day.status === "Izin"
    ).length,
  };
}

export function attendanceDepartmentOptions(
  rows: AttendanceDailyRow[]
): string[] {
  return [...new Set(rows.map((row) => row.employee.department))].sort((a, b) =>
    a.localeCompare(b, "id")
  );
}
