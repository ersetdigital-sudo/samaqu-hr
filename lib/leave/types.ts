/** Tipe domain modul Cuti & Izin. */

import type { EmployeeStatus } from "@/lib/employees/types";
import type { HolidayEntry, WorkSchedule } from "@/lib/attendance/types";

export const LEAVE_CATEGORIES = [
  "annual",
  "sick",
  "permission",
  "special",
] as const;

export type LeaveCategory = (typeof LEAVE_CATEGORIES)[number];

export const LEAVE_STATUSES = [
  "Menunggu",
  "Disetujui",
  "Ditolak",
  "Dibatalkan",
] as const;

export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const LEAVE_DAY_STATUSES = ["Cuti", "Sakit", "Izin"] as const;

/** Status yang dipakai Attendance Tahap A saat pengajuan Disetujui. */
export type LeaveDayStatus = (typeof LEAVE_DAY_STATUSES)[number];

export type LeaveType = {
  code: string;
  name: string;
  category: LeaveCategory;
  description: string | null;
  countsCalendarDays: boolean;
  deductsAnnualBalance: boolean;
  annualEntitlement: number | null;
  quotaDays: number | null;
  requiresReason: boolean;
  requiresEventNote: boolean;
  requiresDoctorNoteAfterWorkdays: number | null;
  allowPastDays: number;
  sortOrder: number;
  isActive: boolean;
};

export type LeaveAttachmentMime =
  | "application/pdf"
  | "image/jpeg"
  | "image/png";

export type LeaveAttachment = {
  fileName: string;
  fileSize: number;
  mimeType: LeaveAttachmentMime;
};

export type LeaveHistoryEntry = {
  id: number;
  action: "Diajukan" | "Disetujui" | "Ditolak" | "Dibatalkan Karyawan" | "Dibatalkan HR";
  fromStatus: LeaveStatus | null;
  toStatus: LeaveStatus | null;
  reason: string | null;
  actorName: string;
  actedAt: string;
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  employeeDepartment: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  leaveTypeCategory: LeaveCategory;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string | null;
  eventNote: string | null;
  status: LeaveStatus;
  attachment: LeaveAttachment | null;
  submittedAt: string;
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancellationKind: "Karyawan" | "HR" | null;
  cancellationReason: string | null;
  history: LeaveHistoryEntry[];
};

export type LeaveEmployee = {
  id: string;
  fullName: string;
  position: string;
  department: string;
  status: EmployeeStatus;
  joinedAt: string;
};

export type LeaveBalance = {
  employeeId: string;
  fullName: string;
  department: string;
  jobPosition: string;
  status: EmployeeStatus;
  joinedAt: string;
  entitlement: number;
  used: number;
  remaining: number;
  eligible: boolean;
  eligibleDate: string;
};

export type LeaveCalendarEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeDepartment: string;
  leaveTypeName: string;
  leaveTypeCategory: LeaveCategory;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: LeaveStatus;
};

export type LeaveEmployeeData = {
  linked: boolean;
  employee: LeaveEmployee | null;
  todayIso: string;
  year: number;
  balance: LeaveBalance | null;
  types: LeaveType[];
  requests: LeaveRequest[];
  schedule: WorkSchedule | null;
  holidays: HolidayEntry[];
};

export type LeaveApprovalData = {
  todayIso: string;
  year: number;
  types: LeaveType[];
  pending: LeaveRequest[];
  history: LeaveRequest[];
  balances: LeaveBalance[];
  activeLeaves: LeaveCalendarEntry[];
};

export type LeaveBalanceData = {
  todayIso: string;
  year: number;
  balances: LeaveBalance[];
};

export type LeaveCalendarData = {
  todayIso: string;
  month: string;
  entries: LeaveCalendarEntry[];
};

/** Input form mentah; dipakai validasi murni dan API. */
export type LeaveRequestInput = {
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  reason: string;
  eventNote: string;
};

export type LeaveFieldErrors = Record<string, string>;

export type LeaveDecision = "Disetujui" | "Ditolak";
