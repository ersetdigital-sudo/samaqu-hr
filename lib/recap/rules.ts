/**
 * Aturan murni Rekap Kehadiran.
 *
 * Sumber status tunggal tetap `computeAttendanceDay` dari Attendance Tahap A.
 * Modul ini hanya mengagregasi status per periode; tidak menggandakan logika
 * keterlambatan/pulang cepat/alfa/cuti.
 */

import {
  computeAttendanceDay,
  isValidMonthKey,
  monthRange,
  shiftMonth,
} from "@/lib/attendance/rules";
import type {
  AttendanceDay,
  AttendanceRecord,
  HolidayEntry,
  WorkSchedule,
} from "@/lib/attendance/types";
import type { LeaveDayStatus } from "@/lib/leave/types";
import type {
  RecapEmployee,
  RecapFilters,
  RecapInput,
  RecapPeriod,
  RecapRow,
  RecapSort,
  RecapSortKey,
} from "@/lib/recap/types";

const pad = (value: number) => String(value).padStart(2, "0");

const nextIsoDate = (dateIso: string): string => {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;
};

export function resolveRecapPeriod(
  monthKey: string,
  startDay: number
): RecapPeriod {
  if (!isValidMonthKey(monthKey)) {
    throw new Error("Bulan rekap tidak valid");
  }

  const day = Math.min(Math.max(Math.trunc(startDay), 1), 28);
  const current = monthRange(monthKey);
  if (day === 1) {
    return { month: monthKey, from: current.from, to: current.to, startDay: 1 };
  }

  const previousMonth = shiftMonth(monthKey, -1);
  const previous = monthRange(previousMonth);
  const previousLastDay = Number(previous.to.slice(8, 10));
  const currentLastDay = Number(current.to.slice(8, 10));
  const fromDay = Math.min(day, previousLastDay);
  const toDay = Math.min(day - 1, currentLastDay);

  return {
    month: monthKey,
    from: `${previousMonth}-${pad(fromDay)}`,
    to: `${monthKey}-${pad(toDay)}`,
    startDay: day,
  };
}

export function resolveRecapSchedule(
  schedules: WorkSchedule[],
  employeeId: string
): WorkSchedule | null {
  const specific = schedules.find(
    (schedule) => schedule.isActive && schedule.employeeId === employeeId
  );
  if (specific) return specific;
  return (
    schedules.find(
      (schedule) => schedule.isActive && schedule.employeeId === null
    ) ?? null
  );
}

const minIso = (a: string, b: string) => (a < b ? a : b);
const maxIso = (a: string, b: string) => (a > b ? a : b);

export type RecapRange = { start: string; end: string };

export function recapEmployeeRange(
  employee: RecapEmployee,
  period: RecapPeriod,
  todayIso: string,
  lastActivityDate: string | null
): RecapRange | null {
  const effectivePeriodEnd = minIso(period.to, todayIso);
  let start = maxIso(period.from, employee.joinedAt);
  let end = effectivePeriodEnd;

  if (employee.status === "Nonaktif") {
    const cutoff =
      employee.activeEndDate ??
      (employee.inactiveDateKnown ? null : lastActivityDate);
    if (!cutoff) return null;
    end = minIso(end, cutoff);
  }

  if (start > end) return null;
  return { start, end };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function buildRecapRows({
  employees,
  period,
  todayIso,
  schedules,
  holidays,
  records,
  leaves,
  overtime,
}: RecapInput): RecapRow[] {
  const holidayByDate = new Map(
    holidays.map((holiday) => [holiday.holidayDate, holiday])
  );
  const recordsByEmployee = new Map<
    string,
    Map<string, AttendanceRecord>
  >();
  const leavesByEmployee = new Map<
    string,
    Map<string, LeaveDayStatus>
  >();
  const overtimeByEmployee = new Map<
    string,
    Map<string, { approved: number; equivalent: number }>
  >();
  const lastActivityByEmployee = new Map<string, string>();

  for (const record of records) {
    const byDate = recordsByEmployee.get(record.employeeId) ?? new Map();
    byDate.set(record.workDate, record);
    recordsByEmployee.set(record.employeeId, byDate);

    const current = lastActivityByEmployee.get(record.employeeId);
    if (!current || record.workDate > current) {
      lastActivityByEmployee.set(record.employeeId, record.workDate);
    }
  }

  for (const leave of leaves) {
    const byDate = leavesByEmployee.get(leave.employeeId) ?? new Map();
    let cursor = leave.startDate;
    while (cursor <= leave.endDate) {
      byDate.set(cursor, leave.status);
      cursor = nextIsoDate(cursor);
    }
    leavesByEmployee.set(leave.employeeId, byDate);

    const current = lastActivityByEmployee.get(leave.employeeId);
    if (!current || leave.endDate > current) {
      lastActivityByEmployee.set(leave.employeeId, leave.endDate);
    }
  }

  for (const entry of overtime) {
    const byDate = overtimeByEmployee.get(entry.employeeId) ?? new Map();
    const current = byDate.get(entry.requestDate) ?? {
      approved: 0,
      equivalent: 0,
    };
    current.approved += entry.approvedMinutes;
    current.equivalent += entry.equivalentMinutes;
    byDate.set(entry.requestDate, current);
    overtimeByEmployee.set(entry.employeeId, byDate);
  }

  return employees.map((employee) => {
    const schedule = resolveRecapSchedule(schedules, employee.id);
    const range = recapEmployeeRange(
      employee,
      period,
      todayIso,
      lastActivityByEmployee.get(employee.id) ?? null
    );
    const employeeRecords = recordsByEmployee.get(employee.id);
    const employeeLeaves = leavesByEmployee.get(employee.id);
    const employeeOvertime = overtimeByEmployee.get(employee.id);
    const days: AttendanceDay[] = [];

    let workdays = 0;
    let present = 0;
    let lateCount = 0;
    let lateMinutes = 0;
    let earlyCount = 0;
    let earlyMinutes = 0;
    let missingCheckout = 0;
    let alfa = 0;
    let cuti = 0;
    let sakit = 0;
    let izin = 0;
    let workMinutes = 0;
    let overtimeApprovedMinutes = 0;
    let overtimeEquivalentMinutes = 0;

    if (range) {
      let cursor = range.start;
      while (cursor <= range.end) {
        const overtimeForDay = employeeOvertime?.get(cursor);
        if (overtimeForDay) {
          overtimeApprovedMinutes += overtimeForDay.approved;
          overtimeEquivalentMinutes += overtimeForDay.equivalent;
        }

        const day = computeAttendanceDay({
          date: cursor,
          todayIso,
          schedule,
          holidayName: holidayByDate.get(cursor)?.name ?? null,
          record: employeeRecords?.get(cursor) ?? null,
          joinedAt: employee.joinedAt,
          leaveStatus: employeeLeaves?.get(cursor) ?? null,
        });
        days.push(day);

        workMinutes += day.durationMinutes ?? 0;

        if (day.dayType === "workday") {
          workdays += 1;
          if (
            day.status === "Hadir" ||
            day.status === "Terlambat" ||
            day.status === "Pulang Cepat"
          ) {
            present += 1;
          }
          if (day.late) {
            lateCount += 1;
            lateMinutes += day.lateMinutes;
          }
          if (day.early) {
            earlyCount += 1;
            earlyMinutes += day.earlyMinutes;
          }

          if (day.status === "Lupa Check-out") missingCheckout += 1;
          else if (day.status === "Alfa") alfa += 1;
          else if (day.status === "Cuti") cuti += 1;
          else if (day.status === "Sakit") sakit += 1;
          else if (day.status === "Izin") izin += 1;
        }

        cursor = nextIsoDate(cursor);
      }
    }

    return {
      employee,
      workdays,
      present,
      lateCount,
      lateMinutes,
      earlyCount,
      earlyMinutes,
      missingCheckout,
      alfa,
      cuti,
      sakit,
      izin,
      workMinutes,
      attendancePercent: workdays > 0 ? round1((present / workdays) * 100) : 0,
      problemDays: alfa + missingCheckout,
      overtimeApprovedMinutes,
      overtimeEquivalentMinutes,
      days,
    };
  });
}

export function filterRecapRows(
  rows: RecapRow[],
  filters: RecapFilters
): RecapRow[] {
  const term = filters.q.trim().toLowerCase();

  return rows.filter((row) => {
    const haystack =
      `${row.employee.fullName} ${row.employee.id}`.toLowerCase();
    return (
      (!term || haystack.includes(term)) &&
      (filters.department === "Semua" ||
        row.employee.department === filters.department) &&
      (filters.status === "Semua" || row.employee.status === filters.status)
    );
  });
}

export function sortRecapRows(
  rows: RecapRow[],
  sort: RecapSort
): RecapRow[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  const valueOf = (row: RecapRow, key: RecapSortKey): string | number => {
    switch (key) {
      case "employee":
        return row.employee.fullName;
      case "workdays":
        return row.workdays;
      case "present":
        return row.present;
      case "late":
        return row.lateCount;
      case "early":
        return row.earlyCount;
      case "missing":
        return row.missingCheckout;
      case "alfa":
        return row.alfa;
      case "cuti":
        return row.cuti;
      case "sakit":
        return row.sakit;
      case "izin":
        return row.izin;
      case "workMinutes":
        return row.workMinutes;
      case "attendancePercent":
        return row.attendancePercent;
      case "overtime":
        return row.overtimeApprovedMinutes;
    }
  };

  return [...rows].sort((a, b) => {
    const left = valueOf(a, sort.key);
    const right = valueOf(b, sort.key);
    if (typeof left === "string" && typeof right === "string") {
      return left.localeCompare(right, "id") * factor;
    }
    return (Number(left) - Number(right)) * factor;
  });
}

export type RecapSummary = {
  averageAttendance: number;
  totalAlfa: number;
  totalLateMinutes: number;
  missingCheckoutEmployees: number;
  totalOvertimeApprovedMinutes: number;
  totalOvertimeEquivalentMinutes: number;
};

export function buildRecapSummary(rows: RecapRow[]): RecapSummary {
  const rowsWithWorkdays = rows.filter((row) => row.workdays > 0);
  return {
    averageAttendance:
      rowsWithWorkdays.length > 0
        ? round1(
            rowsWithWorkdays.reduce(
              (sum, row) => sum + row.attendancePercent,
              0
            ) / rowsWithWorkdays.length
          )
        : 0,
    totalAlfa: rows.reduce((sum, row) => sum + row.alfa, 0),
    totalLateMinutes: rows.reduce((sum, row) => sum + row.lateMinutes, 0),
    missingCheckoutEmployees: rows.filter(
      (row) => row.missingCheckout > 0
    ).length,
    totalOvertimeApprovedMinutes: rows.reduce(
      (sum, row) => sum + row.overtimeApprovedMinutes,
      0
    ),
    totalOvertimeEquivalentMinutes: rows.reduce(
      (sum, row) => sum + row.overtimeEquivalentMinutes,
      0
    ),
  };
}

export function recapDepartmentOptions(rows: RecapRow[]): string[] {
  return [...new Set(rows.map((row) => row.employee.department))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "id"));
}

export function recapStatusOptions(rows: RecapRow[]): string[] {
  return [...new Set(rows.map((row) => row.employee.status))];
}
