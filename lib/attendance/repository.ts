/** Lapisan akses data Attendance Tahap A (server-side). */

import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { isoDateJakarta } from "@/lib/datetime";
import { monthRange } from "@/lib/attendance/rules";
import { addDaysIso, leaveDayStatusForCategory } from "@/lib/leave/rules";
import type { LeaveCategory, LeaveDayStatus } from "@/lib/leave/types";
import type {
  AttendanceCorrection,
  AttendanceDailyData,
  AttendanceEmployee,
  AttendanceLeaveDay,
  AttendanceLeaveStatus,
  AttendanceMonthData,
  AttendanceRecord,
  CorrectionInput,
  HolidayEntry,
  HolidayInput,
  ScheduleInput,
  WorkSchedule,
} from "@/lib/attendance/types";
import type { EmployeeStatus } from "@/lib/employees/types";

export class AttendanceDataError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string>;

  constructor(
    message: string,
    status = 400,
    errors?: Record<string, string>
  ) {
    super(message);
    this.name = "AttendanceDataError";
    this.status = status;
    this.errors = errors;
  }
}

type ScheduleRow = {
  id: string;
  employee_id: string | null;
  name: string;
  work_days: number[];
  start_time: string;
  end_time: string;
  break_minutes: number;
  late_tolerance_minutes: number;
  is_active: boolean;
};

type HolidayRow = {
  id: string;
  holiday_date: string;
  name: string;
};

type AttendanceRow = {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  source: AttendanceRecord["source"];
  notes: string | null;
  updated_at: string;
};

type CorrectionRow = {
  id: number;
  attendance_id: string;
  employee_id: string;
  work_date: string;
  old_check_in_at: string | null;
  old_check_out_at: string | null;
  new_check_in_at: string | null;
  new_check_out_at: string | null;
  reason: string;
  corrected_by: string | null;
  corrected_at: string;
};

type EmployeeRow = {
  id: string;
  full_name: string;
  position: string;
  department: string;
  status: EmployeeStatus;
  joined_at: string;
};

type LeaveRequestRow = {
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_type_code: string;
  leave_types:
    | { category: LeaveCategory }
    | { category: LeaveCategory }[]
    | null;
};

const SCHEDULE_COLUMNS =
  "id, employee_id, name, work_days, start_time, end_time, break_minutes, late_tolerance_minutes, is_active";
const HOLIDAY_COLUMNS = "id, holiday_date, name";
const ATTENDANCE_COLUMNS =
  "id, employee_id, work_date, check_in_at, check_out_at, source, notes, updated_at";
const EMPLOYEE_COLUMNS = "id, full_name, position, department, status, joined_at";
const LEAVE_COLUMNS =
  "employee_id, start_date, end_date, leave_type_code, leave_types(category)";

const normalizeTime = (value: string): string => value.slice(0, 5);

const mapDbError = (error: { code?: string }, action: string) => {
  if (error.code === "42501") {
    return new AttendanceDataError(
      "Akses ditolak oleh aturan keamanan data",
      403
    );
  }
  return new AttendanceDataError(`Gagal ${action} data kehadiran`, 500);
};

const mapRpcError = (error: { message?: string; code?: string }) => {
  const message =
    error.message?.replace(/^.*?:\s*/, "") || "Gagal memproses kehadiran";

  if (error.code === "42501") return new AttendanceDataError(message, 403);
  if (error.code === "P0002") return new AttendanceDataError(message, 404);
  if (
    error.code === "P0001" ||
    error.code === "23514" ||
    error.code === "23502" ||
    error.code === "22007" ||
    error.code === "22008" ||
    error.code === "22P02"
  ) {
    return new AttendanceDataError(message, 400);
  }
  if (error.code === "23505") {
    return new AttendanceDataError("Tanggal libur sudah terdaftar", 409);
  }
  return new AttendanceDataError("Gagal memproses kehadiran", 500);
};

const toSchedule = (row: ScheduleRow): WorkSchedule => ({
  id: row.id,
  employeeId: row.employee_id,
  name: row.name,
  workDays: (row.work_days ?? []).map(Number).sort((a, b) => a - b),
  startTime: normalizeTime(row.start_time),
  endTime: normalizeTime(row.end_time),
  breakMinutes: row.break_minutes,
  lateToleranceMinutes: row.late_tolerance_minutes,
  isActive: row.is_active,
});

const toHoliday = (row: HolidayRow): HolidayEntry => ({
  id: row.id,
  holidayDate: row.holiday_date,
  name: row.name,
});

const toAttendance = (row: AttendanceRow): AttendanceRecord => ({
  id: row.id,
  employeeId: row.employee_id,
  workDate: row.work_date,
  checkInAt: row.check_in_at,
  checkOutAt: row.check_out_at,
  source: row.source,
  notes: row.notes,
  updatedAt: row.updated_at,
});

const toEmployee = (row: EmployeeRow): AttendanceEmployee => ({
  id: row.id,
  fullName: row.full_name,
  position: row.position,
  department: row.department,
  status: row.status,
  joinedAt: row.joined_at,
});

const leaveCategoryOf = (row: LeaveRequestRow): LeaveCategory => {
  const relation = Array.isArray(row.leave_types)
    ? row.leave_types[0]
    : row.leave_types;
  if (relation?.category) return relation.category;
  if (row.leave_type_code === "sick") return "sick";
  if (row.leave_type_code === "permission") return "permission";
  if (row.leave_type_code === "annual") return "annual";
  return "special";
};

const leaveStatusOf = (row: LeaveRequestRow): LeaveDayStatus =>
  leaveDayStatusForCategory(leaveCategoryOf(row));

const buildLeaveDays = (
  rows: LeaveRequestRow[],
  from: string,
  to: string
): AttendanceLeaveDay[] => {
  const byDate = new Map<string, LeaveDayStatus>();

  for (const row of rows) {
    const status = leaveStatusOf(row);
    let cursor = row.start_date > from ? row.start_date : from;
    const limit = row.end_date < to ? row.end_date : to;
    while (cursor <= limit) {
      byDate.set(cursor, status);
      cursor = addDaysIso(cursor, 1);
    }
  }

  return [...byDate.entries()]
    .map(([date, status]) => ({ date, status }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const leaveStatusOnDate = (
  rows: LeaveRequestRow[],
  date: string
): LeaveDayStatus | null => {
  const row = rows.find(
    (item) => item.start_date <= date && item.end_date >= date
  );
  return row ? leaveStatusOf(row) : null;
};

const getActiveSchedule = async (): Promise<WorkSchedule | null> => {
  const { data, error } = await (await getServerSupabase())
    .from("work_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("is_active", true)
    .is("employee_id", null)
    .maybeSingle();

  if (error) throw mapDbError(error, "memuat jadwal kerja");
  return data ? toSchedule(data as ScheduleRow) : null;
};

const loadActorNames = async (
  rows: CorrectionRow[]
): Promise<{ nameById: Map<string, string>; resolved: boolean }> => {
  const ids = [
    ...new Set(
      rows
        .map((row) => row.corrected_by)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const nameById = new Map<string, string>();
  if (ids.length === 0) return { nameById, resolved: true };

  const { data, error } = await (await getServerSupabase()).rpc(
    "user_full_names",
    { p_ids: ids }
  );
  if (error) return { nameById, resolved: false };

  for (const actor of (data ?? []) as { id: string; full_name: string }[]) {
    nameById.set(actor.id, actor.full_name);
  }
  return { nameById, resolved: true };
};

const toCorrection = (
  row: CorrectionRow,
  actorNames: { nameById: Map<string, string>; resolved: boolean }
): AttendanceCorrection => ({
  id: row.id,
  attendanceId: row.attendance_id,
  employeeId: row.employee_id,
  workDate: row.work_date,
  oldCheckInAt: row.old_check_in_at,
  oldCheckOutAt: row.old_check_out_at,
  newCheckInAt: row.new_check_in_at,
  newCheckOutAt: row.new_check_out_at,
  reason: row.reason,
  correctedByName: row.corrected_by
    ? actorNames.nameById.get(row.corrected_by) ??
      (actorNames.resolved ? "Pengguna terhapus" : "HR")
    : "Sistem",
  correctedAt: row.corrected_at,
});

export async function getMyAttendanceMonth(
  monthKey: string
): Promise<AttendanceMonthData> {
  const db = await getServerSupabase();
  const todayIso = isoDateJakarta();
  const serverNow = new Date().toISOString();
  const { data: employeeId, error: employeeIdError } = await db.rpc(
    "current_employee_id"
  );

  if (employeeIdError) {
    throw new AttendanceDataError("Gagal memuat identitas karyawan", 500);
  }

  if (typeof employeeId !== "string" || employeeId === "") {
    return {
      linked: false,
      employee: null,
      schedule: null,
      todayIso,
      serverNow,
      todayRecord: null,
      monthRecords: [],
      holidays: [],
      leaveDays: [],
      todayLeaveStatus: null,
    };
  }

  const { from, to } = monthRange(monthKey);
  const [employeeResult, schedule, holidayResult, todayHolidayResult, recordResult, todayRecordResult, leaveResult, todayLeaveResult] =
    await Promise.all([
      db
        .from("employees")
        .select(EMPLOYEE_COLUMNS)
        .eq("id", employeeId)
        .maybeSingle(),
      getActiveSchedule(),
      db
        .from("holidays")
        .select(HOLIDAY_COLUMNS)
        .gte("holiday_date", from)
        .lte("holiday_date", to)
        .order("holiday_date", { ascending: true }),
      db
        .from("holidays")
        .select(HOLIDAY_COLUMNS)
        .eq("holiday_date", todayIso)
        .maybeSingle(),
      db
        .from("attendance")
        .select(ATTENDANCE_COLUMNS)
        .eq("employee_id", employeeId)
        .gte("work_date", from)
        .lte("work_date", to)
        .order("work_date", { ascending: true }),
      db
        .from("attendance")
        .select(ATTENDANCE_COLUMNS)
        .eq("employee_id", employeeId)
        .eq("work_date", todayIso)
        .maybeSingle(),
      db
        .from("leave_requests")
        .select(LEAVE_COLUMNS)
        .eq("employee_id", employeeId)
        .eq("status", "Disetujui")
        .lte("start_date", to)
        .gte("end_date", from),
      db
        .from("leave_requests")
        .select(LEAVE_COLUMNS)
        .eq("employee_id", employeeId)
        .eq("status", "Disetujui")
        .lte("start_date", todayIso)
        .gte("end_date", todayIso),
    ]);

  if (employeeResult.error) {
    throw mapDbError(employeeResult.error, "memuat karyawan");
  }
  if (holidayResult.error) {
    throw mapDbError(holidayResult.error, "memuat kalender libur");
  }
  if (todayHolidayResult.error) {
    throw mapDbError(todayHolidayResult.error, "memuat kalender libur");
  }
  if (recordResult.error) {
    throw mapDbError(recordResult.error, "memuat riwayat kehadiran");
  }
  if (todayRecordResult.error) {
    throw mapDbError(todayRecordResult.error, "memuat kehadiran hari ini");
  }
  if (leaveResult.error) {
    throw mapDbError(leaveResult.error, "memuat cuti bulan ini");
  }
  if (todayLeaveResult.error) {
    throw mapDbError(todayLeaveResult.error, "memuat cuti hari ini");
  }

  const holidayMap = new Map<string, HolidayEntry>();
  ((holidayResult.data ?? []) as HolidayRow[]).forEach((row) => {
    holidayMap.set(row.holiday_date, toHoliday(row));
  });
  if (todayHolidayResult.data) {
    const holiday = toHoliday(todayHolidayResult.data as HolidayRow);
    holidayMap.set(holiday.holidayDate, holiday);
  }

  return {
    linked: true,
    employee: employeeResult.data
      ? toEmployee(employeeResult.data as EmployeeRow)
      : null,
    schedule,
    todayIso,
    serverNow,
    todayRecord: todayRecordResult.data
      ? toAttendance(todayRecordResult.data as AttendanceRow)
      : null,
    monthRecords: ((recordResult.data ?? []) as AttendanceRow[]).map(
      toAttendance
    ),
    holidays: [...holidayMap.values()].sort((a, b) =>
      a.holidayDate.localeCompare(b.holidayDate)
    ),
    leaveDays: buildLeaveDays(
      (leaveResult.data ?? []) as LeaveRequestRow[],
      from,
      to
    ),
    todayLeaveStatus: leaveStatusOnDate(
      (todayLeaveResult.data ?? []) as LeaveRequestRow[],
      todayIso
    ),
  };
}

export async function getDailyAttendance(
  dateIso: string
): Promise<AttendanceDailyData> {
  const db = await getServerSupabase();
  const todayIso = isoDateJakarta();
  const serverNow = new Date().toISOString();

  const [schedule, holidayResult, employeeResult, attendanceResult, correctionResult, leaveResult] =
    await Promise.all([
      getActiveSchedule(),
      db
        .from("holidays")
        .select(HOLIDAY_COLUMNS)
        .eq("holiday_date", dateIso)
        .maybeSingle(),
      db
        .from("employees")
        .select(EMPLOYEE_COLUMNS)
        .in("status", ["Aktif", "Probation"])
        .lte("joined_at", dateIso)
        .order("full_name", { ascending: true }),
      db
        .from("attendance")
        .select(ATTENDANCE_COLUMNS)
        .eq("work_date", dateIso),
      db
        .from("attendance_corrections")
        .select(
          "id, attendance_id, employee_id, work_date, old_check_in_at, old_check_out_at, new_check_in_at, new_check_out_at, reason, corrected_by, corrected_at"
        )
        .eq("work_date", dateIso)
        .order("corrected_at", { ascending: false }),
      db
        .from("leave_requests")
        .select(LEAVE_COLUMNS)
        .eq("status", "Disetujui")
        .lte("start_date", dateIso)
        .gte("end_date", dateIso),
    ]);

  if (holidayResult.error) {
    throw mapDbError(holidayResult.error, "memuat kalender libur");
  }
  if (employeeResult.error) {
    throw mapDbError(employeeResult.error, "memuat karyawan");
  }
  if (attendanceResult.error) {
    throw mapDbError(attendanceResult.error, "memuat kehadiran");
  }
  if (correctionResult.error) {
    throw mapDbError(correctionResult.error, "memuat riwayat koreksi");
  }
  if (leaveResult.error) {
    throw mapDbError(leaveResult.error, "memuat cuti karyawan");
  }

  const correctionRows = (correctionResult.data ?? []) as CorrectionRow[];
  const actorNames = await loadActorNames(correctionRows);
  const leaveStatuses: AttendanceLeaveStatus[] = (
    (leaveResult.data ?? []) as LeaveRequestRow[]
  ).map((row) => ({
    employeeId: row.employee_id,
    status: leaveStatusOf(row),
  }));

  return {
    date: dateIso,
    todayIso,
    serverNow,
    schedule,
    holiday: holidayResult.data
      ? toHoliday(holidayResult.data as HolidayRow)
      : null,
    employees: ((employeeResult.data ?? []) as EmployeeRow[]).map(toEmployee),
    attendance: ((attendanceResult.data ?? []) as AttendanceRow[]).map(
      toAttendance
    ),
    corrections: correctionRows.map((row) => toCorrection(row, actorNames)),
    leaveStatuses,
  };
}

export async function getScheduleBoard(): Promise<{
  schedule: WorkSchedule | null;
  holidays: HolidayEntry[];
}> {
  const db = await getServerSupabase();
  const [schedule, holidayResult] = await Promise.all([
    getActiveSchedule(),
    db
      .from("holidays")
      .select(HOLIDAY_COLUMNS)
      .order("holiday_date", { ascending: true }),
  ]);

  if (holidayResult.error) {
    throw mapDbError(holidayResult.error, "memuat kalender libur");
  }

  return {
    schedule,
    holidays: ((holidayResult.data ?? []) as HolidayRow[]).map(toHoliday),
  };
}

export async function checkIn(): Promise<AttendanceRecord> {
  const { data, error } = await (await getServerSupabase()).rpc("check_in");
  if (error) throw mapRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new AttendanceDataError("Check-in gagal disimpan", 500);
  return toAttendance(row as AttendanceRow);
}

export async function checkOut(): Promise<AttendanceRecord> {
  const { data, error } = await (await getServerSupabase()).rpc("check_out");
  if (error) throw mapRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new AttendanceDataError("Check-out gagal disimpan", 500);
  return toAttendance(row as AttendanceRow);
}

export async function correctAttendance(
  input: CorrectionInput
): Promise<AttendanceRecord> {
  const { data, error } = await (await getServerSupabase()).rpc(
    "correct_attendance",
    {
      p_employee_id: input.employeeId,
      p_work_date: input.workDate,
      p_check_in_time: input.checkInTime,
      p_check_out_time: input.checkOutTime,
      p_reason: input.reason,
    }
  );

  if (error) throw mapRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new AttendanceDataError("Koreksi kehadiran gagal disimpan", 500);
  }
  return toAttendance(row as AttendanceRow);
}

export async function updateWorkSchedule(
  input: ScheduleInput
): Promise<WorkSchedule> {
  const { data, error } = await (await getServerSupabase()).rpc(
    "update_work_schedule",
    {
      p_work_days: input.workDays,
      p_start_time: input.startTime,
      p_end_time: input.endTime,
      p_break_minutes: input.breakMinutes,
      p_late_tolerance_minutes: input.lateToleranceMinutes,
    }
  );

  if (error) throw mapRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new AttendanceDataError("Jadwal gagal disimpan", 500);
  return toSchedule(row as ScheduleRow);
}

export async function saveHoliday(
  input: HolidayInput,
  id: string | null = null
): Promise<HolidayEntry> {
  const { data, error } = await (await getServerSupabase()).rpc(
    "save_holiday",
    {
      p_id: id,
      p_holiday_date: input.holidayDate,
      p_name: input.name,
    }
  );

  if (error) throw mapRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new AttendanceDataError("Hari libur gagal disimpan", 500);
  return toHoliday(row as HolidayRow);
}

export async function deleteHoliday(id: string): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc("delete_holiday", {
    p_id: id,
  });
  if (error) throw mapRpcError(error);
}
