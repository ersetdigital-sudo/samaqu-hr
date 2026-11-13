/** Lapisan akses data Rekap Kehadiran (server-side). */

import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { isoDateJakarta } from "@/lib/datetime";
import { addDaysIso, leaveDayStatusForCategory } from "@/lib/leave/rules";
import type { LeaveCategory, LeaveDayStatus } from "@/lib/leave/types";
import type { EmployeeStatus } from "@/lib/employees/types";
import { buildRecapRows, resolveRecapPeriod } from "@/lib/recap/rules";
import type {
  MyRecapData,
  RecapData,
  RecapEmployee,
  RecapLeave,
  RecapPeriod,
  RecapSettings,
} from "@/lib/recap/types";
import type {
  AttendanceRecord,
  HolidayEntry,
  WorkSchedule,
} from "@/lib/attendance/types";

export class RecapDataError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RecapDataError";
    this.status = status;
  }
}

type SettingsRow = {
  period_start_day: number;
  updated_by: string | null;
  updated_at: string;
};

type EmployeeRow = {
  id: string;
  full_name: string;
  position: string;
  department: string;
  status: EmployeeStatus;
  joined_at: string;
};

type StatusHistoryRow = {
  employee_id: string;
  to_status: EmployeeStatus;
  changed_at: string;
};

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

type LeaveRow = {
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_type_code: string;
  leave_types:
    | { category: LeaveCategory }
    | { category: LeaveCategory }[]
    | null;
};

type OvertimeRow = {
  employee_id: string;
  request_date: string;
  approved_minutes: number | null;
  equivalent_minutes: number | null;
};

const SETTINGS_COLUMNS = "period_start_day, updated_by, updated_at";
const EMPLOYEE_COLUMNS =
  "id, full_name, position, department, status, joined_at";
const SCHEDULE_COLUMNS =
  "id, employee_id, name, work_days, start_time, end_time, break_minutes, late_tolerance_minutes, is_active";
const HOLIDAY_COLUMNS = "id, holiday_date, name";
const ATTENDANCE_COLUMNS =
  "id, employee_id, work_date, check_in_at, check_out_at, source, notes, updated_at";
const LEAVE_COLUMNS =
  "employee_id, start_date, end_date, leave_type_code, leave_types(category)";
const OVERTIME_COLUMNS =
  "employee_id, request_date, approved_minutes, equivalent_minutes";

const DEFAULT_SETTINGS: RecapSettings = {
  periodStartDay: 1,
  updatedAt: null,
  updatedByName: null,
};

const normalizeTime = (value: string): string => value.slice(0, 5);

const mapDbError = (error: { code?: string }, action: string) => {
  if (error.code === "42501") {
    return new RecapDataError("Akses ditolak oleh aturan keamanan data", 403);
  }
  return new RecapDataError(`Gagal ${action} data rekap kehadiran`, 500);
};

const mapRpcError = (error: { message?: string; code?: string }) => {
  const message =
    error.message?.replace(/^.*?:\s*/, "") || "Gagal memproses pengaturan rekap";
  if (error.code === "42501") return new RecapDataError(message, 403);
  if (error.code === "P0001" || error.code === "22P02") {
    return new RecapDataError(message, 400);
  }
  return new RecapDataError("Gagal memproses pengaturan rekap", 500);
};

const resolveActorName = async (
  userId: string | null
): Promise<string | null> => {
  if (!userId) return null;
  const { data, error } = await (await getServerSupabase()).rpc(
    "user_full_names",
    { p_ids: [userId] }
  );
  if (error) return "Pengguna";
  const actor = ((data ?? []) as { id: string; full_name: string }[])[0];
  return actor?.full_name ?? "Pengguna terhapus";
};

const toSettings = async (row: SettingsRow | null): Promise<RecapSettings> => {
  if (!row) return DEFAULT_SETTINGS;
  return {
    periodStartDay: Number(row.period_start_day),
    updatedAt: row.updated_at,
    updatedByName: await resolveActorName(row.updated_by),
  };
};

export async function getRecapSettings(): Promise<RecapSettings> {
  const { data, error } = await (await getServerSupabase())
    .from("attendance_recap_settings")
    .select(SETTINGS_COLUMNS)
    .eq("id", true)
    .maybeSingle();

  if (error) throw mapDbError(error, "memuat pengaturan");
  return toSettings(data as SettingsRow | null);
}

export async function updateRecapSettings(
  periodStartDay: number
): Promise<RecapSettings> {
  const { error } = await (await getServerSupabase()).rpc(
    "update_attendance_recap_settings",
    { p_period_start_day: periodStartDay }
  );
  if (error) throw mapRpcError(error);
  return getRecapSettings();
}

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

const leaveCategoryOf = (row: LeaveRow): LeaveCategory => {
  const relation = Array.isArray(row.leave_types)
    ? row.leave_types[0]
    : row.leave_types;
  if (relation?.category) return relation.category;
  if (row.leave_type_code === "sick") return "sick";
  if (row.leave_type_code === "permission") return "permission";
  if (row.leave_type_code === "annual") return "annual";
  return "special";
};

const leaveStatusOf = (row: LeaveRow): LeaveDayStatus =>
  leaveDayStatusForCategory(leaveCategoryOf(row));

const toEmployee = (
  row: EmployeeRow,
  activeEndDate: string | null,
  inactiveDateKnown: boolean
): RecapEmployee => ({
  id: row.id,
  fullName: row.full_name,
  department: row.department,
  position: row.position,
  status: row.status,
  joinedAt: row.joined_at,
  activeEndDate,
  inactiveDateKnown,
});

const loadEmployees = async (
  employeeIds?: string[]
): Promise<{ rows: EmployeeRow[]; activeEndById: Map<string, string>; inactiveIds: string[] }> => {
  const db = await getServerSupabase();
  let query = db
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .order("full_name", { ascending: true });

  if (employeeIds && employeeIds.length > 0) {
    query = query.in("id", employeeIds);
  }

  const { data, error } = await query;
  if (error) throw mapDbError(error, "memuat karyawan");

  const rows = (data ?? []) as EmployeeRow[];
  const inactiveIds = rows
    .filter((row) => row.status === "Nonaktif")
    .map((row) => row.id);
  const activeEndById = new Map<string, string>();

  if (inactiveIds.length > 0) {
    const historyResult = await db
      .from("employee_status_history")
      .select("employee_id, to_status, changed_at")
      .in("employee_id", inactiveIds)
      .eq("to_status", "Nonaktif")
      .order("changed_at", { ascending: false });

    if (historyResult.error) {
      throw mapDbError(historyResult.error, "memuat riwayat status karyawan");
    }

    for (const history of (historyResult.data ?? []) as StatusHistoryRow[]) {
      if (activeEndById.has(history.employee_id)) continue;
      activeEndById.set(
        history.employee_id,
        addDaysIso(isoDateJakarta(new Date(history.changed_at)), -1)
      );
    }
  }

  return { rows, activeEndById, inactiveIds };
};

const loadSchedules = async (): Promise<WorkSchedule[]> => {
  const { data, error } = await (await getServerSupabase())
    .from("work_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("is_active", true);

  if (error) throw mapDbError(error, "memuat jadwal kerja");
  return ((data ?? []) as ScheduleRow[]).map(toSchedule);
};

const loadHolidays = async (period: RecapPeriod): Promise<HolidayEntry[]> => {
  const { data, error } = await (await getServerSupabase())
    .from("holidays")
    .select(HOLIDAY_COLUMNS)
    .gte("holiday_date", period.from)
    .lte("holiday_date", period.to)
    .order("holiday_date", { ascending: true });

  if (error) throw mapDbError(error, "memuat kalender libur");
  return ((data ?? []) as HolidayRow[]).map(toHoliday);
};

const loadRecords = async (
  period: RecapPeriod
): Promise<AttendanceRecord[]> => {
  const { data, error } = await (await getServerSupabase())
    .from("attendance")
    .select(ATTENDANCE_COLUMNS)
    .gte("work_date", period.from)
    .lte("work_date", period.to)
    .order("work_date", { ascending: true });

  if (error) throw mapDbError(error, "memuat kehadiran");
  return ((data ?? []) as AttendanceRow[]).map(toAttendance);
};

const loadLeaves = async (period: RecapPeriod): Promise<RecapLeave[]> => {
  const { data, error } = await (await getServerSupabase())
    .from("leave_requests")
    .select(LEAVE_COLUMNS)
    .eq("status", "Disetujui")
    .lte("start_date", period.to)
    .gte("end_date", period.from);

  if (error) throw mapDbError(error, "memuat cuti yang disetujui");

  return ((data ?? []) as LeaveRow[]).map((row) => ({
    employeeId: row.employee_id,
    startDate: row.start_date,
    endDate: row.end_date,
    status: leaveStatusOf(row),
  }));
};

const loadOvertime = async (
  period: RecapPeriod
): Promise<
  {
    employeeId: string;
    requestDate: string;
    approvedMinutes: number;
    equivalentMinutes: number;
  }[]
> => {
  const { data, error } = await (await getServerSupabase())
    .from("overtime_requests")
    .select(OVERTIME_COLUMNS)
    .eq("status", "Disetujui")
    .gte("request_date", period.from)
    .lte("request_date", period.to);

  if (error) throw mapDbError(error, "memuat lembur");

  return ((data ?? []) as OvertimeRow[])
    .filter(
      (row) => row.approved_minutes !== null && row.equivalent_minutes !== null
    )
    .map((row) => ({
      employeeId: row.employee_id,
      requestDate: row.request_date,
      approvedMinutes: row.approved_minutes ?? 0,
      equivalentMinutes: row.equivalent_minutes ?? 0,
    }));
};

export async function getRecapData(
  month: string,
  employeeIds?: string[]
): Promise<RecapData> {
  const settings = await getRecapSettings();
  const period = resolveRecapPeriod(month, settings.periodStartDay);
  const todayIso = isoDateJakarta();

  const [employeeResult, schedules, holidays, records, leaves, overtime] =
    await Promise.all([
      loadEmployees(employeeIds),
      loadSchedules(),
      loadHolidays(period),
      loadRecords(period),
      loadLeaves(period),
      loadOvertime(period),
    ]);

  const { rows, activeEndById } = employeeResult;
  const inactiveIds = new Set(employeeResult.inactiveIds);
  const employees = rows.map((row) =>
    toEmployee(
      row,
      activeEndById.get(row.id) ?? null,
      !inactiveIds.has(row.id) || activeEndById.has(row.id)
    )
  );

  return {
    todayIso,
    settings,
    period,
    rows: buildRecapRows({
      employees,
      period,
      todayIso,
      schedules,
      holidays,
      records,
      leaves,
      overtime,
    }),
  };
}

export async function getMyRecap(month: string): Promise<MyRecapData> {
  const db = await getServerSupabase();
  const todayIso = isoDateJakarta();

  const { data: employeeId, error: employeeError } = await db.rpc(
    "current_employee_id"
  );
  if (employeeError) {
    throw new RecapDataError("Gagal memuat identitas karyawan", 500);
  }

  if (typeof employeeId !== "string" || employeeId === "") {
    const settings = await getRecapSettings();
    return {
      linked: false,
      employee: null,
      row: null,
      todayIso,
      settings,
      period: resolveRecapPeriod(month, settings.periodStartDay),
    };
  }

  const data = await getRecapData(month, [employeeId]);
  const row = data.rows.find((item) => item.employee.id === employeeId) ?? null;

  return {
    linked: Boolean(row),
    employee: row?.employee ?? null,
    row,
    todayIso,
    settings: data.settings,
    period: data.period,
  };
}
