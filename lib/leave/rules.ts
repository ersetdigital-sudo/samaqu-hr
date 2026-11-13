/**
 * Aturan bisnis Cuti & Izin (murni, tanpa React/database).
 *
 * Dipakai form, halaman, dan validasi API. Database tetap menjadi penentu
 * akhir lewat RPC SECURITY DEFINER.
 */

import { isoWeekday, isValidIsoDate } from "@/lib/attendance/rules";
import type { HolidayEntry, WorkSchedule } from "@/lib/attendance/types";
import { formatDateID } from "@/lib/datetime";
import type {
  LeaveBalance,
  LeaveCategory,
  LeaveDayStatus,
  LeaveEmployee,
  LeaveFieldErrors,
  LeaveRequest,
  LeaveRequestInput,
  LeaveStatus,
  LeaveType,
} from "@/lib/leave/types";

export function leaveCategoryLabel(category: LeaveCategory): string {
  switch (category) {
    case "annual":
      return "Cuti Tahunan";
    case "sick":
      return "Sakit";
    case "permission":
      return "Izin";
    case "special":
      return "Cuti Khusus";
  }
}

export function leaveStatusTone(status: LeaveStatus): string {
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

export function leaveDayStatusForCategory(
  category: LeaveCategory
): LeaveDayStatus {
  if (category === "sick") return "Sakit";
  if (category === "permission") return "Izin";
  return "Cuti";
}

export function leaveDayStatusForType(type: LeaveType): LeaveDayStatus {
  return leaveDayStatusForCategory(type.category);
}

export function leaveTypeFor(
  types: LeaveType[],
  code: string
): LeaveType | null {
  return types.find((type) => type.code === code) ?? null;
}

export type LeaveBalanceDisplay = {
  eligible: boolean;
  entitlement: number;
  used: number;
  remaining: number;
  statusLabel: "Hak aktif" | "Belum berhak" | "Probation" | "Nonaktif";
  statusTone: "t-ok" | "t-warn" | "t-mute";
  activeDateLabel: string | null;
  note: string;
};

/**
 * Tampilan saldo yang konsisten untuk HR dan karyawan.
 * Data mentah tetap dari RPC; hanya nilai tampilan yang dinormalkan saat
 * karyawan belum berhak agar tidak terlihat memiliki kuota.
 */
export function leaveBalanceDisplay(
  balance: LeaveBalance | null,
  todayIso: string
): LeaveBalanceDisplay | null {
  if (!balance) return null;

  if (balance.eligible) {
    return {
      eligible: true,
      entitlement: balance.entitlement,
      used: balance.used,
      remaining: balance.remaining,
      statusLabel: "Hak aktif",
      statusTone: "t-ok",
      activeDateLabel: null,
      note: "Hak cuti tahunan aktif. Cuti tahunan tidak dapat dibawa ke tahun berikutnya.",
    };
  }

  const futureDate =
    balance.eligibleDate > todayIso
      ? formatDateID(balance.eligibleDate)
      : null;

  if (balance.status === "Nonaktif") {
    return {
      eligible: false,
      entitlement: 0,
      used: balance.used,
      remaining: 0,
      statusLabel: "Nonaktif",
      statusTone: "t-mute",
      activeDateLabel: null,
      note: "Karyawan Nonaktif tidak memiliki hak cuti tahunan.",
    };
  }

  if (balance.status === "Probation") {
    return {
      eligible: false,
      entitlement: 0,
      used: balance.used,
      remaining: 0,
      statusLabel: "Probation",
      statusTone: "t-warn",
      activeDateLabel: futureDate,
      note: futureDate
        ? `Status masih Probation. Hak cuti tahunan aktif setelah status Aktif dan 12 bulan masa kerja (${futureDate}).`
        : "Status masih Probation. Hak cuti tahunan aktif setelah status Aktif dan 12 bulan masa kerja.",
    };
  }

  return {
    eligible: false,
    entitlement: 0,
    used: balance.used,
    remaining: 0,
    statusLabel: "Belum berhak",
    statusTone: "t-mute",
    activeDateLabel: futureDate,
    note: futureDate
      ? `Hak cuti tahunan aktif setelah 12 bulan masa kerja (${futureDate}).`
      : "Hak cuti tahunan belum aktif.",
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

export function addDaysIso(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;
}

export function addMonthsIso(dateIso: string, months: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + months);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;
}

export function annualEligibilityDate(joinedAt: string): string {
  return addMonthsIso(joinedAt, 12);
}

export function isAnnualEligible(
  employee: Pick<LeaveEmployee, "joinedAt" | "status">,
  startDate: string,
  todayIso: string
): boolean {
  return (
    employee.status === "Aktif" &&
    annualEligibilityDate(employee.joinedAt) <= startDate &&
    annualEligibilityDate(employee.joinedAt) <= todayIso
  );
}

export function countCalendarDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function countLeaveDays({
  type,
  startDate,
  endDate,
  schedule,
  holidays,
}: {
  type: LeaveType;
  startDate: string;
  endDate: string;
  schedule: WorkSchedule | null;
  holidays: HolidayEntry[];
}): number {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) return 0;
  if (endDate < startDate) return 0;
  if (type.countsCalendarDays) return countCalendarDays(startDate, endDate);
  if (!schedule || schedule.workDays.length === 0) return 0;

  const holidayDates = new Set(holidays.map((holiday) => holiday.holidayDate));
  let days = 0;
  let cursor = startDate;
  while (cursor <= endDate) {
    if (
      schedule.workDays.includes(isoWeekday(cursor)) &&
      !holidayDates.has(cursor)
    ) {
      days += 1;
    }
    cursor = addDaysIso(cursor, 1);
  }
  return days;
}

export function leaveDates(startDate: string, endDate: string): string[] {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) return [];
  if (endDate < startDate) return [];
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return dates;
}

export function leaveRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

export function isActiveLeaveStatus(status: LeaveStatus): boolean {
  return status === "Menunggu" || status === "Disetujui";
}

export function findOverlappingRequest(
  requests: LeaveRequest[],
  startDate: string,
  endDate: string,
  excludeId?: string
): LeaveRequest | null {
  return (
    requests.find(
      (request) =>
        request.id !== excludeId &&
        isActiveLeaveStatus(request.status) &&
        leaveRangesOverlap(
          startDate,
          endDate,
          request.startDate,
          request.endDate
        )
    ) ?? null
  );
}

export function needsDoctorNote(type: LeaveType, days: number): boolean {
  return (
    type.requiresDoctorNoteAfterWorkdays !== null &&
    days >= type.requiresDoctorNoteAfterWorkdays
  );
}

export function annualRemainingAfter(
  balance: LeaveBalance | null,
  days: number
): number | null {
  if (!balance) return null;
  return balance.remaining - days;
}

export type LeaveValidationContext = {
  todayIso: string;
  employee: LeaveEmployee | null;
  types: LeaveType[];
  schedule: WorkSchedule | null;
  holidays: HolidayEntry[];
  balance: LeaveBalance | null;
  requests: LeaveRequest[];
  /** True bila pengguna sudah memilih file lampiran yang lolos validasi. */
  hasAttachment: boolean;
  attachmentError?: string | null;
};

export type LeaveValidationResult = {
  errors: LeaveFieldErrors;
  days: number;
  type: LeaveType | null;
};

/** Validasi UI/API. Pesan dibuat spesifik per field agar mudah ditindak. */
export function validateLeaveInput(
  input: LeaveRequestInput,
  context: LeaveValidationContext
): LeaveValidationResult {
  const errors: LeaveFieldErrors = {};
  const type = leaveTypeFor(context.types, input.leaveTypeCode);

  if (!context.employee) {
    errors.form = "Akun belum tertaut ke data karyawan.";
    return { errors, days: 0, type };
  }
  if (context.employee.status === "Nonaktif") {
    errors.form = "Karyawan Nonaktif tidak bisa mengajukan cuti.";
  }

  if (!type || !type.isActive) {
    errors.leaveTypeCode = "Pilih jenis cuti yang valid.";
    return { errors, days: 0, type };
  }

  if (!input.startDate) errors.startDate = "Tanggal mulai wajib diisi.";
  else if (!isValidIsoDate(input.startDate))
    errors.startDate = "Tanggal mulai tidak valid.";

  if (!input.endDate) errors.endDate = "Tanggal selesai wajib diisi.";
  else if (!isValidIsoDate(input.endDate))
    errors.endDate = "Tanggal selesai tidak valid.";

  if (errors.startDate || errors.endDate) {
    return { errors, days: 0, type };
  }

  if (input.endDate < input.startDate) {
    errors.endDate = "Tanggal selesai tidak boleh sebelum tanggal mulai.";
    return { errors, days: 0, type };
  }

  const earliest = addDaysIso(context.todayIso, -type.allowPastDays);
  if (input.startDate < earliest) {
    errors.startDate =
      type.allowPastDays === 0
        ? "Tanggal mulai hanya boleh hari ini atau setelahnya."
        : `Tanggal mulai paling cepat ${type.allowPastDays} hari ke belakang.`;
  }

  const days = countLeaveDays({
    type,
    startDate: input.startDate,
    endDate: input.endDate,
    schedule: context.schedule,
    holidays: context.holidays,
  });

  if (!type.countsCalendarDays && !context.schedule) {
    errors.form = "Jadwal kerja belum diatur oleh HR.";
  } else if (days === 0 && !errors.startDate && !errors.endDate) {
    errors.endDate = "Rentang tanggal tidak mengandung hari kerja.";
  }

  const reason = input.reason.trim();
  if (type.requiresReason && !reason) {
    errors.reason = "Alasan wajib diisi untuk jenis cuti ini.";
  } else if (reason.length > 1000) {
    errors.reason = "Alasan maksimal 1000 karakter.";
  }

  const eventNote = input.eventNote.trim();
  if (type.requiresEventNote && !eventNote) {
    errors.eventNote = "Keterangan kejadian wajib diisi.";
  } else if (eventNote.length > 500) {
    errors.eventNote = "Keterangan kejadian maksimal 500 karakter.";
  }

  if (type.quotaDays !== null && days > type.quotaDays) {
    errors.endDate = `Jumlah hari (${days}) melebihi kuota ${type.quotaDays} hari.`;
  }

  if (type.deductsAnnualBalance) {
    if (input.startDate.slice(0, 4) !== input.endDate.slice(0, 4)) {
      errors.endDate = "Cuti tahunan harus berada dalam satu tahun kalender.";
    } else if (input.startDate.slice(0, 4) !== context.todayIso.slice(0, 4)) {
      errors.startDate = "Cuti tahunan hanya bisa diajukan untuk tahun berjalan.";
    } else if (context.employee.status !== "Aktif") {
      errors.form =
        "Hak cuti tahunan belum aktif untuk karyawan Probation.";
    } else {
      const eligibleDate = annualEligibilityDate(context.employee.joinedAt);
      if (input.startDate < eligibleDate) {
        errors.startDate = `Hak cuti tahunan aktif setelah 12 bulan masa kerja (${formatDateID(
          eligibleDate
        )}).`;
      } else if (!context.balance) {
        errors.form = "Saldo cuti tahunan belum bisa dimuat.";
      } else if (days > context.balance.remaining) {
        errors.endDate = `Sisa saldo cuti tahunan tidak cukup (${context.balance.remaining} hari).`;
      }
    }
  }

  const overlap = findOverlappingRequest(
    context.requests,
    input.startDate,
    input.endDate
  );
  if (overlap) {
    errors.form = `Rentang tanggal tumpang tindih dengan pengajuan ${overlap.leaveTypeName} (${overlap.startDate}–${overlap.endDate}) yang masih ${overlap.status}.`;
  }

  if (context.attachmentError) {
    errors.attachment = context.attachmentError;
  } else if (needsDoctorNote(type, days) && !context.hasAttachment) {
    errors.attachment = `Surat dokter wajib dilampirkan untuk sakit ${type.requiresDoctorNoteAfterWorkdays} hari kerja atau lebih.`;
  }

  return { errors, days, type };
}

export function leaveStatusLabel(request: LeaveRequest): string {
  return request.status;
}
