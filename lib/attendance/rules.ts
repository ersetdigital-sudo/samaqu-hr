/**
 * Aturan murni Attendance: hari kerja, status harian, durasi, dan kalender.
 * Dipakai UI dan API; tidak mengimpor React/database.
 *
 * Titik sambung Cuti: `leaveStatus` dapat diisi "Cuti" oleh modul Cuti nanti.
 * Saat terisi dan belum ada check-in, status Cuti menimpa Alfa/Belum Masuk.
 */

import { formatClockID } from "@/lib/datetime";
import type { LeaveDayStatus } from "@/lib/leave/types";
import type {
  AttendanceDay,
  AttendanceRecord,
  AttendanceStatus,
  HolidayEntry,
  WorkSchedule,
} from "@/lib/attendance/types";

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
  7: "Minggu",
};

export const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((value) => ({
  value,
  label: WEEKDAY_LABELS[value],
}));

const pad = (value: number) => String(value).padStart(2, "0");

export function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isoWeekday(dateIso: string): number {
  const [year, month, day] = dateIso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function monthKeyOf(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function isValidMonthKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function monthRange(monthKey: string): { from: string; to: string } {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-${pad(lastDay)}`,
  };
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

export function datesInMonth(monthKey: string): string[] {
  const { to } = monthRange(monthKey);
  const lastDay = Number(to.slice(8, 10));
  return Array.from(
    { length: lastDay },
    (_, index) => `${monthKey}-${pad(index + 1)}`
  );
}

/** Menerima "08:00" maupun "08:00:00" dari Postgres. */
export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const minutesBetween = (from: string, to: string): number | null => {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.round((end - start) / 60_000));
};

export type AttendanceComputationInput = {
  date: string;
  todayIso: string;
  schedule: WorkSchedule | null;
  holidayName: string | null;
  record: AttendanceRecord | null;
  joinedAt?: string | null;
  /** Titik sambung modul Cuti. Null/undefined = belum ada data cuti. */
  leaveStatus?: LeaveDayStatus | null;
};

export function computeAttendanceDay({
  date,
  todayIso,
  schedule,
  holidayName,
  record,
  joinedAt = null,
  leaveStatus = null,
}: AttendanceComputationInput): AttendanceDay {
  const beforeEmployment = Boolean(joinedAt && date < joinedAt);

  let dayType: AttendanceDay["dayType"] = "offday";
  if (beforeEmployment) {
    dayType = "before-employment";
  } else if (holidayName) {
    dayType = "holiday";
  } else if (schedule && schedule.workDays.includes(isoWeekday(date))) {
    dayType = "workday";
  }

  const base: AttendanceDay = {
    date,
    dayType,
    holidayName,
    status: null,
    late: false,
    early: false,
    lateMinutes: 0,
    earlyMinutes: 0,
    durationMinutes: null,
    record,
  };

  if (beforeEmployment) return base;

  if (record?.checkInAt) {
    const checkInMinutes = parseTimeToMinutes(formatClockID(record.checkInAt));
    const startMinutes = schedule
      ? parseTimeToMinutes(schedule.startTime)
      : null;
    const endMinutes = schedule ? parseTimeToMinutes(schedule.endTime) : null;

    const late =
      checkInMinutes !== null && startMinutes !== null
        ? checkInMinutes >
          startMinutes + (schedule?.lateToleranceMinutes ?? 0)
        : false;
    const lateMinutes =
      late && checkInMinutes !== null && startMinutes !== null
        ? Math.max(
            0,
            checkInMinutes -
              startMinutes -
              (schedule?.lateToleranceMinutes ?? 0)
          )
        : 0;

    if (!record.checkOutAt) {
      return {
        ...base,
        status: date < todayIso ? "Lupa Check-out" : "Belum Check-out",
        late,
        lateMinutes,
      };
    }

    const checkOutMinutes = parseTimeToMinutes(
      formatClockID(record.checkOutAt)
    );
    const early =
      checkOutMinutes !== null && endMinutes !== null
        ? checkOutMinutes < endMinutes
        : false;
    const earlyMinutes =
      early && checkOutMinutes !== null && endMinutes !== null
        ? Math.max(0, endMinutes - checkOutMinutes)
        : 0;

    const status: AttendanceStatus = late
      ? "Terlambat"
      : early
        ? "Pulang Cepat"
        : "Hadir";

    return {
      ...base,
      status,
      late,
      early,
      lateMinutes,
      earlyMinutes,
      durationMinutes: minutesBetween(record.checkInAt, record.checkOutAt),
    };
  }

  if (dayType === "holiday" || dayType === "offday") {
    return base;
  }

  if (leaveStatus) {
    return { ...base, status: leaveStatus };
  }

  if (date < todayIso) {
    return { ...base, status: "Alfa" };
  }
  if (date === todayIso) {
    return { ...base, status: "Belum Masuk" };
  }

  return base;
}

export function attendanceStatusTone(status: AttendanceStatus): string {
  switch (status) {
    case "Hadir":
      return "t-ok";
    case "Terlambat":
    case "Pulang Cepat":
      return "t-warn";
    case "Lupa Check-out":
      return "t-bad";
    case "Alfa":
      return "t-bad";
    case "Belum Check-out":
    case "Cuti":
    case "Sakit":
    case "Izin":
      return "t-info";
    case "Belum Masuk":
    default:
      return "t-mute";
  }
}

export function attendanceDayKindLabel(
  dayType: AttendanceDay["dayType"]
): string {
  if (dayType === "holiday") return "Libur";
  if (dayType === "offday") return "Non-kerja";
  if (dayType === "before-employment") return "—";
  return "";
}

export function attendanceDayLabel(day: AttendanceDay): string {
  if (day.status) return day.status;
  if (day.dayType === "holiday") return "Libur";
  if (day.dayType === "offday") return "Non-kerja";
  return "—";
}

export function workDaysLabel(workDays: number[]): string {
  return [...workDays]
    .sort((a, b) => a - b)
    .map((day) => WEEKDAY_LABELS[day] ?? String(day))
    .join(", ");
}

export function formatDurationMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} mnt`;
}

export type BuildMonthDaysInput = {
  monthKey: string;
  todayIso: string;
  schedule: WorkSchedule | null;
  holidays: HolidayEntry[];
  records: AttendanceRecord[];
  joinedAt?: string | null;
  leaveStatusForDate?: (dateIso: string) => LeaveDayStatus | null;
};

export function buildAttendanceMonthDays({
  monthKey,
  todayIso,
  schedule,
  holidays,
  records,
  joinedAt = null,
  leaveStatusForDate,
}: BuildMonthDaysInput): AttendanceDay[] {
  const holidayMap = new Map(
    holidays.map((holiday) => [holiday.holidayDate, holiday.name])
  );
  const recordMap = new Map(records.map((record) => [record.workDate, record]));

  return datesInMonth(monthKey).map((date) =>
    computeAttendanceDay({
      date,
      todayIso,
      schedule,
      holidayName: holidayMap.get(date) ?? null,
      record: recordMap.get(date) ?? null,
      joinedAt,
      leaveStatus: leaveStatusForDate?.(date) ?? null,
    })
  );
}
