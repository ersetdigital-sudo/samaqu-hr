/** Tipe domain Attendance Tahap A. */

import type { EmployeeStatus } from "@/lib/employees/types";

export type AttendanceStatus =
  | "Hadir"
  | "Terlambat"
  | "Pulang Cepat"
  | "Belum Check-out"
  | "Lupa Check-out"
  | "Alfa"
  | "Belum Masuk"
  /** Titik sambung modul Cuti: nanti menimpa Alfa/Belum Masuk. */
  | "Cuti";

export type AttendanceDayType =
  | "workday"
  | "holiday"
  | "offday"
  | "before-employment";

export type WorkSchedule = {
  id: string;
  employeeId: string | null;
  name: string;
  /** ISO weekday: 1 = Senin ... 7 = Minggu. */
  workDays: number[];
  /** "08:00" WIB. */
  startTime: string;
  endTime: string;
  breakMinutes: number;
  lateToleranceMinutes: number;
  isActive: boolean;
};

export type HolidayEntry = {
  id: string;
  holidayDate: string;
  name: string;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  source: "Mandiri" | "Koreksi HR";
  notes: string | null;
  updatedAt: string;
};

export type AttendanceCorrection = {
  id: number;
  attendanceId: string;
  employeeId: string;
  workDate: string;
  oldCheckInAt: string | null;
  oldCheckOutAt: string | null;
  newCheckInAt: string | null;
  newCheckOutAt: string | null;
  reason: string;
  correctedByName: string | null;
  correctedAt: string;
};

export type AttendanceEmployee = {
  id: string;
  fullName: string;
  position: string;
  department: string;
  status: EmployeeStatus;
  joinedAt: string;
};

export type AttendanceDay = {
  date: string;
  dayType: AttendanceDayType;
  holidayName: string | null;
  status: AttendanceStatus | null;
  late: boolean;
  early: boolean;
  lateMinutes: number;
  earlyMinutes: number;
  durationMinutes: number | null;
  record: AttendanceRecord | null;
};

export type AttendanceMonthData = {
  linked: boolean;
  employee: AttendanceEmployee | null;
  schedule: WorkSchedule | null;
  todayIso: string;
  serverNow: string;
  todayRecord: AttendanceRecord | null;
  monthRecords: AttendanceRecord[];
  holidays: HolidayEntry[];
};

export type AttendanceDailyRow = {
  employee: AttendanceEmployee;
  day: AttendanceDay;
  corrections: AttendanceCorrection[];
};

export type AttendanceDailyData = {
  date: string;
  todayIso: string;
  serverNow: string;
  schedule: WorkSchedule | null;
  holiday: HolidayEntry | null;
  employees: AttendanceEmployee[];
  attendance: AttendanceRecord[];
  corrections: AttendanceCorrection[];
};

export type ScheduleInput = {
  workDays: number[];
  startTime: string;
  endTime: string;
  breakMinutes: number;
  lateToleranceMinutes: number;
};

export type HolidayInput = {
  holidayDate: string;
  name: string;
};

export type CorrectionInput = {
  employeeId: string;
  workDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  reason: string;
};

export type AttendanceFieldErrors = Record<string, string>;
