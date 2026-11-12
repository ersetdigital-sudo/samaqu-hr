/** Filter, ringkasan, dan pembentukan baris kehadiran harian. */

import {
  attendanceDayLabel,
  computeAttendanceDay,
} from "@/lib/attendance/rules";
import type {
  AttendanceCorrection,
  AttendanceDailyRow,
  AttendanceEmployee,
  AttendanceRecord,
  AttendanceStatus,
  HolidayEntry,
  WorkSchedule,
} from "@/lib/attendance/types";

export const ATTENDANCE_STATUS_VALUES: AttendanceStatus[] = [
  "Hadir",
  "Terlambat",
  "Pulang Cepat",
  "Belum Check-out",
  "Lupa Check-out",
  "Belum Masuk",
  "Alfa",
  "Cuti",
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
}: {
  date: string;
  todayIso: string;
  employees: AttendanceEmployee[];
  attendance: AttendanceRecord[];
  corrections: AttendanceCorrection[];
  schedule: WorkSchedule | null;
  holiday: HolidayEntry | null;
}): AttendanceDailyRow[] {
  const recordByEmployee = new Map(
    attendance.map((record) => [record.employeeId, record])
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
    }),
    corrections: correctionsByEmployee.get(employee.id) ?? [],
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
  };
}

export function attendanceDepartmentOptions(
  rows: AttendanceDailyRow[]
): string[] {
  return [...new Set(rows.map((row) => row.employee.department))].sort((a, b) =>
    a.localeCompare(b, "id")
  );
}
