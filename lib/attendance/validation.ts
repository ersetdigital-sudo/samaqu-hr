/** Validasi input Attendance; dipakai klien dan route API. */

import {
  isValidIsoDate,
  parseTimeToMinutes,
} from "@/lib/attendance/rules";
import type {
  AttendanceFieldErrors,
  CorrectionInput,
  HolidayInput,
  ScheduleInput,
} from "@/lib/attendance/types";

export const HOLIDAY_NAME_MAX = 100;
export const CORRECTION_REASON_MAX = 500;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isValidTime = (value: string): boolean =>
  TIME_PATTERN.test(value);

export const normalizeTimeInput = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export function validateScheduleInput(
  input: ScheduleInput
): AttendanceFieldErrors {
  const errors: AttendanceFieldErrors = {};

  const days = [...new Set(input.workDays)].filter(
    (day) => Number.isInteger(day) && day >= 1 && day <= 7
  );
  if (days.length === 0) {
    errors.workDays = "Pilih minimal satu hari kerja";
  }
  if (days.length !== input.workDays.length) {
    errors.workDays = "Hari kerja tidak valid";
  }

  if (!isValidTime(input.startTime)) {
    errors.startTime = "Jam masuk tidak valid";
  }
  if (!isValidTime(input.endTime)) {
    errors.endTime = "Jam pulang tidak valid";
  }

  const start = parseTimeToMinutes(input.startTime);
  const end = parseTimeToMinutes(input.endTime);
  if (start !== null && end !== null && end <= start) {
    errors.endTime = "Jam pulang harus setelah jam masuk";
  }

  if (
    !Number.isInteger(input.breakMinutes) ||
    input.breakMinutes < 0 ||
    input.breakMinutes > 240
  ) {
    errors.breakMinutes = "Istirahat 0–240 menit";
  }
  if (
    !Number.isInteger(input.lateToleranceMinutes) ||
    input.lateToleranceMinutes < 0 ||
    input.lateToleranceMinutes > 120
  ) {
    errors.lateToleranceMinutes = "Toleransi 0–120 menit";
  }

  return errors;
}

export function validateHolidayInput(
  input: HolidayInput
): AttendanceFieldErrors {
  const errors: AttendanceFieldErrors = {};

  if (!isValidIsoDate(input.holidayDate)) {
    errors.holidayDate = "Tanggal libur tidak valid";
  }

  const name = input.name.trim();
  if (!name) errors.name = "Nama libur wajib diisi";
  else if (name.length > HOLIDAY_NAME_MAX) {
    errors.name = `Nama libur maksimal ${HOLIDAY_NAME_MAX} karakter`;
  }

  return errors;
}

export function validateCorrectionInput(
  input: CorrectionInput,
  options: { todayIso: string }
): AttendanceFieldErrors {
  const errors: AttendanceFieldErrors = {};

  if (!input.employeeId) errors.employeeId = "Pilih karyawan";
  if (!isValidIsoDate(input.workDate)) {
    errors.workDate = "Tanggal tidak valid";
  } else if (input.workDate > options.todayIso) {
    errors.workDate = "Tanggal tidak boleh di masa depan";
  }

  const checkIn = normalizeTimeInput(input.checkInTime);
  const checkOut = normalizeTimeInput(input.checkOutTime);

  if (checkIn && !isValidTime(checkIn)) {
    errors.checkInTime = "Jam masuk tidak valid";
  }
  if (checkOut && !isValidTime(checkOut)) {
    errors.checkOutTime = "Jam pulang tidak valid";
  }

  if (!checkIn && !checkOut) {
    errors.form = "Isi minimal jam masuk atau jam pulang";
  } else if (checkOut && !checkIn) {
    errors.checkOutTime = "Jam pulang membutuhkan jam masuk";
  } else if (checkIn && checkOut) {
    const start = parseTimeToMinutes(checkIn);
    const end = parseTimeToMinutes(checkOut);
    if (start !== null && end !== null && end <= start) {
      errors.checkOutTime = "Jam pulang harus setelah jam masuk";
    }
  }

  const reason = input.reason.trim();
  if (!reason) errors.reason = "Alasan koreksi wajib diisi";
  else if (reason.length > CORRECTION_REASON_MAX) {
    errors.reason = `Alasan maksimal ${CORRECTION_REASON_MAX} karakter`;
  }

  return errors;
}
