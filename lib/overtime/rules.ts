/**
 * Aturan murni Lembur: klasifikasi hari, batas, ekuivalensi, dan validasi.
 * Database tetap menjadi penentu akhir lewat RPC SECURITY DEFINER.
 */

import {
  isValidIsoDate,
  isoWeekday,
  parseTimeToMinutes,
} from "@/lib/attendance/rules";
import type { HolidayEntry, WorkSchedule } from "@/lib/attendance/types";
import type {
  OvertimeDayType,
  OvertimeEmployee,
  OvertimeFieldErrors,
  OvertimeInput,
  OvertimeRequest,
  OvertimeStatus,
} from "@/lib/overtime/types";

export const OVERTIME_MIN_MINUTES = 30;
export const OVERTIME_MAX_DAILY_MINUTES = 240;
export const OVERTIME_MAX_WEEKLY_MINUTES = 1080;
export const OVERTIME_BACKDATE_DAYS = 3;
export const OVERTIME_FUTURE_DAYS = 14;

const pad = (value: number) => String(value).padStart(2, "0");

export function addDaysIso(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;
}

export function overtimeDayTypeLabel(dayType: OvertimeDayType): string {
  switch (dayType) {
    case "workday":
      return "Hari kerja";
    case "restday":
      return "Hari istirahat";
    case "holiday":
      return "Libur nasional/cuti bersama";
  }
}

export function overtimeStatusTone(status: OvertimeStatus): string {
  switch (status) {
    case "Disetujui":
      return "t-ok";
    case "Menunggu":
      return "t-warn";
    case "Ditolak":
      return "t-bad";
    case "Dibatalkan":
      return "t-mute";
  }
}

export function isActiveOvertimeStatus(status: OvertimeStatus): boolean {
  return status === "Menunggu" || status === "Disetujui";
}

export function resolveOvertimeSchedule(
  schedules: WorkSchedule[],
  employeeId: string
): WorkSchedule | null {
  return (
    schedules.find(
      (schedule) => schedule.isActive && schedule.employeeId === employeeId
    ) ??
    schedules.find(
      (schedule) => schedule.isActive && schedule.employeeId === null
    ) ??
    null
  );
}

export function overtimeDayType(
  dateIso: string,
  schedule: WorkSchedule | null,
  holidays: HolidayEntry[]
): OvertimeDayType | null {
  if (holidays.some((holiday) => holiday.holidayDate === dateIso)) {
    return "holiday";
  }
  if (!schedule) return null;
  return schedule.workDays.includes(isoWeekday(dateIso))
    ? "workday"
    : "restday";
}

/** Ekuivalen dalam menit; selaras dengan fungsi database. */
export function overtimeEquivalentMinutes(
  minutes: number,
  dayType: OvertimeDayType
): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;

  if (dayType === "workday") {
    return Math.round(
      Math.min(minutes, 60) * 1.5 + Math.max(minutes - 60, 0) * 2
    );
  }

  if (dayType === "restday" || dayType === "holiday") {
    return Math.round(
      Math.min(minutes, 420) * 2 +
        Math.min(Math.max(minutes - 420, 0), 60) * 3 +
        Math.max(minutes - 480, 0) * 4
    );
  }

  return 0;
}

const hoursNumber = (minutes: number): string => {
  const hours = Math.round((minutes / 60) * 100) / 100;
  return String(hours).replace(".", ",");
};

export function overtimeHoursLabel(minutes: number | null): string {
  if (minutes === null) return "—";
  return `${hoursNumber(minutes)} jam`;
}

export function overtimeFormulaLabel(
  minutes: number,
  dayType: OvertimeDayType
): string {
  if (minutes <= 0) return "Belum ada jam disetujui.";

  if (dayType === "workday") {
    const first = Math.min(minutes, 60);
    const rest = Math.max(minutes - 60, 0);
    const parts = [`${hoursNumber(first)} jam × 1,5`];
    if (rest > 0) parts.push(`${hoursNumber(rest)} jam × 2`);
    return `${parts.join(" + ")} = ${hoursNumber(
      overtimeEquivalentMinutes(minutes, dayType)
    )} jam ekuivalen`;
  }

  const first = Math.min(minutes, 420);
  const eighth = Math.min(Math.max(minutes - 420, 0), 60);
  const ninth = Math.max(minutes - 480, 0);
  const parts = [`${hoursNumber(first)} jam × 2`];
  if (eighth > 0) parts.push(`${hoursNumber(eighth)} jam × 3`);
  if (ninth > 0) parts.push(`${hoursNumber(ninth)} jam × 4`);

  return `${parts.join(" + ")} = ${hoursNumber(
    overtimeEquivalentMinutes(minutes, dayType)
  )} jam ekuivalen`;
}

export function overtimeWeekRange(dateIso: string): {
  start: string;
  end: string;
} {
  const start = addDaysIso(dateIso, -(isoWeekday(dateIso) - 1));
  return { start, end: addDaysIso(start, 6) };
}

/** Menit yang dipakai untuk batas: Disetujui memakai jam disetujui. */
export function overtimeUsageMinutes(request: OvertimeRequest): number {
  if (request.status === "Menunggu") return request.requestedMinutes;
  if (request.status === "Disetujui") {
    return request.approvedMinutes ?? request.requestedMinutes;
  }
  return 0;
}

export function overtimeUsageForWeek(
  requests: OvertimeRequest[],
  dateIso: string,
  excludeId?: string
): number {
  const week = overtimeWeekRange(dateIso);
  return requests
    .filter(
      (request) =>
        request.id !== excludeId &&
        isActiveOvertimeStatus(request.status) &&
        request.requestDate >= week.start &&
        request.requestDate <= week.end
    )
    .reduce((sum, request) => sum + overtimeUsageMinutes(request), 0);
}

export function overtimeUsageForDate(
  requests: OvertimeRequest[],
  dateIso: string,
  excludeId?: string
): number {
  return requests
    .filter(
      (request) =>
        request.id !== excludeId &&
        isActiveOvertimeStatus(request.status) &&
        request.requestDate === dateIso
    )
    .reduce((sum, request) => sum + overtimeUsageMinutes(request), 0);
}

export function findOvertimeOverlap(
  requests: OvertimeRequest[],
  dateIso: string,
  startTime: string,
  endTime: string,
  excludeId?: string
): OvertimeRequest | null {
  return (
    requests.find(
      (request) =>
        request.id !== excludeId &&
        isActiveOvertimeStatus(request.status) &&
        request.requestDate === dateIso &&
        startTime < request.endTime &&
        endTime > request.startTime
    ) ?? null
  );
}

export type OvertimeEmployeeSummary = {
  monthlyApprovedMinutes: number;
  monthlyEquivalentMinutes: number;
  weekStart: string;
  weekEnd: string;
  weeklyUsedMinutes: number;
  weeklyRemainingMinutes: number;
};

export function buildOvertimeEmployeeSummary(
  requests: OvertimeRequest[],
  todayIso: string
): OvertimeEmployeeSummary {
  const month = todayIso.slice(0, 7);
  const approved = requests.filter(
    (request) =>
      request.status === "Disetujui" &&
      request.requestDate.slice(0, 7) === month
  );
  const week = overtimeWeekRange(todayIso);
  const weeklyUsedMinutes = overtimeUsageForWeek(requests, todayIso);

  return {
    monthlyApprovedMinutes: approved.reduce(
      (sum, request) => sum + (request.approvedMinutes ?? 0),
      0
    ),
    monthlyEquivalentMinutes: approved.reduce(
      (sum, request) => sum + (request.equivalentMinutes ?? 0),
      0
    ),
    weekStart: week.start,
    weekEnd: week.end,
    weeklyUsedMinutes,
    weeklyRemainingMinutes: Math.max(
      0,
      OVERTIME_MAX_WEEKLY_MINUTES - weeklyUsedMinutes
    ),
  };
}

export type OvertimeApprovalStats = {
  pending: number;
  monthlyApprovedMinutes: number;
  monthlyEquivalentMinutes: number;
  topEmployeeName: string | null;
  topEmployeeMinutes: number;
};

export function buildOvertimeApprovalStats(
  requests: OvertimeRequest[],
  todayIso: string
): OvertimeApprovalStats {
  const month = todayIso.slice(0, 7);
  const unique = new Map<string, OvertimeRequest>();
  for (const request of requests) unique.set(request.id, request);
  const all = [...unique.values()];
  const approvedThisMonth = all.filter(
    (request) =>
      request.status === "Disetujui" &&
      request.requestDate.slice(0, 7) === month
  );
  const byEmployee = new Map<string, { name: string; minutes: number }>();
  for (const request of approvedThisMonth) {
    const current = byEmployee.get(request.employeeId) ?? {
      name: request.employeeName,
      minutes: 0,
    };
    current.minutes += request.approvedMinutes ?? 0;
    byEmployee.set(request.employeeId, current);
  }
  const top = [...byEmployee.values()].sort(
    (a, b) => b.minutes - a.minutes
  )[0];

  return {
    pending: all.filter((request) => request.status === "Menunggu").length,
    monthlyApprovedMinutes: approvedThisMonth.reduce(
      (sum, request) => sum + (request.approvedMinutes ?? 0),
      0
    ),
    monthlyEquivalentMinutes: approvedThisMonth.reduce(
      (sum, request) => sum + (request.equivalentMinutes ?? 0),
      0
    ),
    topEmployeeName: top?.name ?? null,
    topEmployeeMinutes: top?.minutes ?? 0,
  };
}

export type OvertimeValidationContext = {
  todayIso: string;
  employee: OvertimeEmployee | null;
  schedules: WorkSchedule[];
  holidays: HolidayEntry[];
  leaveDates: string[];
  requests: OvertimeRequest[];
};

export type OvertimeValidationResult = {
  errors: OvertimeFieldErrors;
  minutes: number;
  dayType: OvertimeDayType | null;
  equivalentMinutes: number;
  weeklyUsedMinutes: number;
  weeklyRemainingMinutes: number;
};

export function validateOvertimeInput(
  input: OvertimeInput,
  context: OvertimeValidationContext
): OvertimeValidationResult {
  const errors: OvertimeFieldErrors = {};
  let dayType: OvertimeDayType | null = null;
  let minutes = 0;
  let equivalentMinutes = 0;

  if (!context.employee) {
    errors.form = "Akun belum tertaut ke data karyawan.";
    return {
      errors,
      minutes,
      dayType,
      equivalentMinutes,
      weeklyUsedMinutes: 0,
      weeklyRemainingMinutes: OVERTIME_MAX_WEEKLY_MINUTES,
    };
  }
  if (context.employee.status === "Nonaktif") {
    errors.form = "Karyawan Nonaktif tidak bisa mengajukan lembur.";
  }

  if (!input.requestDate) {
    errors.requestDate = "Tanggal lembur wajib diisi.";
  } else if (!isValidIsoDate(input.requestDate)) {
    errors.requestDate = "Tanggal lembur tidak valid.";
  } else {
    const earliest = addDaysIso(
      context.todayIso,
      -OVERTIME_BACKDATE_DAYS
    );
    const latest = addDaysIso(context.todayIso, OVERTIME_FUTURE_DAYS);
    if (input.requestDate < earliest) {
      errors.requestDate =
        "Tanggal lembur paling cepat 3 hari ke belakang.";
    } else if (input.requestDate > latest) {
      errors.requestDate =
        "Tanggal lembur paling lambat 14 hari ke depan.";
    }
  }

  const startMinutes = parseTimeToMinutes(input.startTime);
  const endMinutes = parseTimeToMinutes(input.endTime);

  if (!input.startTime) errors.startTime = "Jam mulai wajib diisi.";
  else if (startMinutes === null)
    errors.startTime = "Jam mulai tidak valid.";

  if (!input.endTime) errors.endTime = "Jam selesai wajib diisi.";
  else if (endMinutes === null) errors.endTime = "Jam selesai tidak valid.";

  if (
    startMinutes !== null &&
    endMinutes !== null &&
    endMinutes <= startMinutes
  ) {
    errors.endTime =
      "Jam selesai harus setelah jam mulai. Lembur lintas tengah malam belum didukung.";
  } else if (startMinutes !== null && endMinutes !== null) {
    minutes = endMinutes - startMinutes;
    if (minutes < OVERTIME_MIN_MINUTES) {
      errors.endTime = "Minimal lembur 30 menit.";
    } else if (minutes % 30 !== 0) {
      errors.endTime = "Jam lembur harus kelipatan 30 menit.";
    } else if (minutes > OVERTIME_MAX_DAILY_MINUTES) {
      errors.endTime = "Maksimal lembur 4 jam per hari.";
    }
  }

  const description = input.workDescription.trim();
  if (!description) {
    errors.workDescription = "Uraian pekerjaan wajib diisi.";
  } else if (description.length > 1000) {
    errors.workDescription = "Uraian pekerjaan maksimal 1000 karakter.";
  }

  if (input.requestDate && context.leaveDates.includes(input.requestDate)) {
    errors.requestDate =
      "Tanggal tersebut sudah tercakup cuti, sakit, atau izin yang disetujui.";
  }

  if (
    input.requestDate &&
    isValidIsoDate(input.requestDate) &&
    minutes > 0
  ) {
    const schedule = resolveOvertimeSchedule(
      context.schedules,
      context.employee.id
    );
    dayType = overtimeDayType(input.requestDate, schedule, context.holidays);
    if (!dayType) {
      errors.form = "Jadwal kerja belum diatur oleh HR.";
    } else {
      equivalentMinutes = overtimeEquivalentMinutes(minutes, dayType);
    }

    const overlap = findOvertimeOverlap(
      context.requests,
      input.requestDate,
      input.startTime,
      input.endTime
    );
    if (overlap) {
      errors.startTime = `Jam tumpang tindih dengan pengajuan ${overlap.startTime.slice(
        0,
        5
      )}–${overlap.endTime.slice(0, 5)}.`;
    }

    const dailyUsed = overtimeUsageForDate(
      context.requests,
      input.requestDate
    );
    if (dailyUsed + minutes > OVERTIME_MAX_DAILY_MINUTES) {
      errors.endTime = `Batas 4 jam per hari terlampaui (${dailyUsed} menit sudah dipakai).`;
    }
  }

  const weeklyUsed = input.requestDate
    ? overtimeUsageForWeek(context.requests, input.requestDate)
    : 0;
  const weeklyRemaining = Math.max(
    0,
    OVERTIME_MAX_WEEKLY_MINUTES - weeklyUsed
  );

  if (minutes > 0 && minutes > weeklyRemaining) {
    errors.requestDate = `Sisa batas minggu ini ${weeklyRemaining} menit; pengajuan ${minutes} menit akan melebihi 18 jam.`;
  }

  return {
    errors,
    minutes,
    dayType,
    equivalentMinutes,
    weeklyUsedMinutes: weeklyUsed,
    weeklyRemainingMinutes: weeklyRemaining,
  };
}

export function filterOvertimeRequests(
  requests: OvertimeRequest[],
  filters: {
    q: string;
    department: string;
    dayType: string;
    from: string;
    to: string;
  }
): OvertimeRequest[] {
  const term = filters.q.trim().toLowerCase();
  return requests.filter((request) => {
    const haystack =
      `${request.employeeName} ${request.employeeId}`.toLowerCase();
    return (
      (!term || haystack.includes(term)) &&
      (filters.department === "Semua" ||
        request.employeeDepartment === filters.department) &&
      (filters.dayType === "Semua" ||
        request.dayType === filters.dayType) &&
      (!filters.from || request.requestDate >= filters.from) &&
      (!filters.to || request.requestDate <= filters.to)
    );
  });
}

export function overtimeDepartmentOptions(
  requests: OvertimeRequest[]
): string[] {
  return [...new Set(requests.map((request) => request.employeeDepartment))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "id"));
}
