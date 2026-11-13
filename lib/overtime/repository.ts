/** Lapisan akses data Lembur (server-side). */

import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { isoDateJakarta } from "@/lib/datetime";
import { addDaysIso } from "@/lib/leave/rules";
import { buildOvertimeEmployeeSummary } from "@/lib/overtime/rules";
import type {
  OvertimeApprovalData,
  OvertimeDayType,
  OvertimeEmployee,
  OvertimeEmployeeData,
  OvertimeFieldErrors,
  OvertimeHistoryEntry,
  OvertimeInput,
  OvertimeRequest,
} from "@/lib/overtime/types";
import type { HolidayEntry, WorkSchedule } from "@/lib/attendance/types";
import type { EmployeeStatus } from "@/lib/employees/types";

export class OvertimeDataError extends Error {
  readonly status: number;
  readonly errors?: OvertimeFieldErrors;

  constructor(message: string, status = 400, errors?: OvertimeFieldErrors) {
    super(message);
    this.name = "OvertimeDataError";
    this.status = status;
    this.errors = errors;
  }
}

type OvertimeRow = {
  id: string;
  employee_id: string;
  request_date: string;
  start_time: string;
  end_time: string;
  requested_minutes: number;
  day_type: OvertimeDayType;
  work_description: string;
  status: OvertimeRequest["status"];
  approved_minutes: number | null;
  equivalent_minutes: number | null;
  submitted_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_kind: "Karyawan" | "HR" | null;
  cancellation_reason: string | null;
};

type HistoryRow = {
  id: number;
  request_id: string;
  action: OvertimeHistoryEntry["action"];
  from_status: OvertimeRequest["status"] | null;
  to_status: OvertimeRequest["status"] | null;
  reason: string | null;
  actor_id: string | null;
  acted_at: string;
};

type EmployeeRow = {
  id: string;
  full_name: string;
  position: string;
  department: string;
  status: EmployeeStatus;
  joined_at: string;
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

type LeaveRangeRow = {
  start_date: string;
  end_date: string;
};

const REQUEST_COLUMNS =
  "id, employee_id, request_date, start_time, end_time, requested_minutes, day_type, work_description, status, approved_minutes, equivalent_minutes, submitted_at, decided_at, decided_by, decision_note, cancelled_at, cancelled_by, cancellation_kind, cancellation_reason";
const HISTORY_COLUMNS =
  "id, request_id, action, from_status, to_status, reason, actor_id, acted_at";
const EMPLOYEE_COLUMNS =
  "id, full_name, position, department, status, joined_at";
const SCHEDULE_COLUMNS =
  "id, employee_id, name, work_days, start_time, end_time, break_minutes, late_tolerance_minutes, is_active";
const HOLIDAY_COLUMNS = "id, holiday_date, name";

const normalizeTime = (value: string): string => value.slice(0, 5);

const mapDbError = (error: { code?: string }, action: string) => {
  if (error.code === "42501") {
    return new OvertimeDataError("Akses ditolak oleh aturan keamanan data", 403);
  }
  return new OvertimeDataError(`Gagal ${action} data lembur`, 500);
};

const mapRpcError = (error: { message?: string; code?: string }) => {
  const message =
    error.message?.replace(/^.*?:\s*/, "") || "Gagal memproses pengajuan lembur";
  if (error.code === "42501") return new OvertimeDataError(message, 403);
  if (error.code === "P0002") return new OvertimeDataError(message, 404);
  if (
    error.code === "P0001" ||
    error.code === "23514" ||
    error.code === "23502" ||
    error.code === "22P02" ||
    error.code === "22007" ||
    error.code === "22008"
  ) {
    return new OvertimeDataError(message, 400);
  }
  return new OvertimeDataError("Gagal memproses pengajuan lembur", 500);
};

const toEmployee = (row: EmployeeRow): OvertimeEmployee => ({
  id: row.id,
  fullName: row.full_name,
  position: row.position,
  department: row.department,
  status: row.status,
  joinedAt: row.joined_at,
});

const loadActorNames = async (
  userIds: (string | null)[]
): Promise<{ nameById: Map<string, string>; resolved: boolean }> => {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
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

const loadHistory = async (
  requestIds: string[]
): Promise<Map<string, OvertimeHistoryEntry[]>> => {
  const grouped = new Map<string, OvertimeHistoryEntry[]>();
  if (requestIds.length === 0) return grouped;

  const { data, error } = await (await getServerSupabase())
    .from("overtime_request_history")
    .select(HISTORY_COLUMNS)
    .in("request_id", requestIds)
    .order("acted_at", { ascending: true });
  if (error) throw mapDbError(error, "memuat riwayat lembur");

  const rows = (data ?? []) as HistoryRow[];
  const actorNames = await loadActorNames(rows.map((row) => row.actor_id));
  for (const row of rows) {
    const list = grouped.get(row.request_id) ?? [];
    list.push({
      id: row.id,
      action: row.action,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      reason: row.reason,
      actorName: row.actor_id
        ? actorNames.nameById.get(row.actor_id) ??
          (actorNames.resolved ? "Pengguna terhapus" : "Pengguna")
        : "Sistem",
      actedAt: row.acted_at,
    });
    grouped.set(row.request_id, list);
  }
  return grouped;
};

const toRequest = (
  row: OvertimeRow,
  employee: OvertimeEmployee | undefined,
  history: OvertimeHistoryEntry[],
  actorNames: { nameById: Map<string, string>; resolved: boolean }
): OvertimeRequest => ({
  id: row.id,
  employeeId: row.employee_id,
  employeeName: employee?.fullName ?? "Karyawan tidak ditemukan",
  employeePosition: employee?.position ?? "—",
  employeeDepartment: employee?.department ?? "—",
  requestDate: row.request_date,
  startTime: normalizeTime(row.start_time),
  endTime: normalizeTime(row.end_time),
  requestedMinutes: row.requested_minutes,
  dayType: row.day_type,
  workDescription: row.work_description,
  status: row.status,
  approvedMinutes: row.approved_minutes,
  equivalentMinutes: row.equivalent_minutes,
  submittedAt: row.submitted_at,
  decidedAt: row.decided_at,
  decidedByName: row.decided_by
    ? actorNames.nameById.get(row.decided_by) ??
      (actorNames.resolved ? "Pengguna terhapus" : "HR")
    : null,
  decisionNote: row.decision_note,
  cancelledAt: row.cancelled_at,
  cancelledByName: row.cancelled_by
    ? actorNames.nameById.get(row.cancelled_by) ??
      (actorNames.resolved ? "Pengguna terhapus" : "HR")
    : null,
  cancellationKind: row.cancellation_kind,
  cancellationReason: row.cancellation_reason,
  history,
});

const loadEmployees = async (ids: string[]): Promise<Map<string, OvertimeEmployee>> => {
  if (ids.length === 0) return new Map();
  const { data, error } = await (await getServerSupabase())
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .in("id", [...new Set(ids)]);
  if (error) throw mapDbError(error, "memuat karyawan");
  return new Map(
    ((data ?? []) as EmployeeRow[]).map((row) => [row.id, toEmployee(row)])
  );
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

const loadSchedules = async (): Promise<WorkSchedule[]> => {
  const { data, error } = await (await getServerSupabase())
    .from("work_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("is_active", true);
  if (error) throw mapDbError(error, "memuat jadwal kerja");
  return ((data ?? []) as ScheduleRow[]).map(toSchedule);
};

const loadHolidays = async (): Promise<HolidayEntry[]> => {
  const { data, error } = await (await getServerSupabase())
    .from("holidays")
    .select(HOLIDAY_COLUMNS)
    .order("holiday_date", { ascending: true });
  if (error) throw mapDbError(error, "memuat kalender libur");
  return ((data ?? []) as HolidayRow[]).map((row) => ({
    id: row.id,
    holidayDate: row.holiday_date,
    name: row.name,
  }));
};

const expandLeaveDates = (rows: LeaveRangeRow[]): string[] => {
  const dates = new Set<string>();
  for (const row of rows) {
    let cursor = row.start_date;
    while (cursor <= row.end_date) {
      dates.add(cursor);
      cursor = addDaysIso(cursor, 1);
    }
  }
  return [...dates].sort();
};

export async function getMyOvertimeData(): Promise<OvertimeEmployeeData> {
  const db = await getServerSupabase();
  const todayIso = isoDateJakarta();
  const month = todayIso.slice(0, 7);
  const formFrom = addDaysIso(todayIso, -3);
  const formTo = addDaysIso(todayIso, 14);

  const { data: employeeId, error: employeeError } = await db.rpc(
    "current_employee_id"
  );
  if (employeeError) {
    throw new OvertimeDataError("Gagal memuat identitas karyawan", 500);
  }

  const [schedules, holidays] = await Promise.all([
    loadSchedules(),
    loadHolidays(),
  ]);

  if (typeof employeeId !== "string" || employeeId === "") {
    const summary = buildOvertimeEmployeeSummary([], todayIso);
    return {
      linked: false,
      employee: null,
      todayIso,
      month,
      requests: [],
      schedule: null,
      holidays,
      leaveDates: [],
      ...summary,
    };
  }

  const [employeeResult, requestResult, leaveResult] = await Promise.all([
    db.from("employees").select(EMPLOYEE_COLUMNS).eq("id", employeeId).maybeSingle(),
    db
      .from("overtime_requests")
      .select(REQUEST_COLUMNS)
      .eq("employee_id", employeeId)
      .order("request_date", { ascending: false })
      .order("submitted_at", { ascending: false })
      .limit(100),
    db
      .from("leave_requests")
      .select("start_date, end_date")
      .eq("employee_id", employeeId)
      .eq("status", "Disetujui")
      .lte("start_date", formTo)
      .gte("end_date", formFrom),
  ]);

  if (employeeResult.error) throw mapDbError(employeeResult.error, "memuat karyawan");
  if (requestResult.error) throw mapDbError(requestResult.error, "memuat pengajuan lembur");
  if (leaveResult.error) throw mapDbError(leaveResult.error, "memuat cuti karyawan");

  const rows = (requestResult.data ?? []) as OvertimeRow[];
  const [histories, actorNames] = await Promise.all([
    loadHistory(rows.map((row) => row.id)),
    loadActorNames(rows.flatMap((row) => [row.decided_by, row.cancelled_by])),
  ]);
  const employee = employeeResult.data
    ? toEmployee(employeeResult.data as EmployeeRow)
    : null;
  const requests = rows.map((row) =>
    toRequest(row, employee ?? undefined, histories.get(row.id) ?? [], actorNames)
  );
  const summary = buildOvertimeEmployeeSummary(requests, todayIso);

  return {
    linked: Boolean(employee),
    employee,
    todayIso,
    month,
    requests,
    schedule: employee
      ? schedules.find((schedule) => schedule.employeeId === employee.id) ??
        schedules.find((schedule) => schedule.employeeId === null) ??
        null
      : null,
    holidays,
    leaveDates: expandLeaveDates((leaveResult.data ?? []) as LeaveRangeRow[]),
    ...summary,
  };
}

export async function getOvertimeApprovalData(): Promise<OvertimeApprovalData> {
  const db = await getServerSupabase();
  const todayIso = isoDateJakarta();
  const activeFrom = addDaysIso(todayIso, -30);
  const activeTo = addDaysIso(todayIso, 21);

  const [pendingResult, historyResult, activeResult] = await Promise.all([
    db
      .from("overtime_requests")
      .select(REQUEST_COLUMNS)
      .eq("status", "Menunggu")
      .order("request_date", { ascending: true })
      .limit(200),
    db
      .from("overtime_requests")
      .select(REQUEST_COLUMNS)
      .neq("status", "Menunggu")
      .order("submitted_at", { ascending: false })
      .limit(200),
    db
      .from("overtime_requests")
      .select(REQUEST_COLUMNS)
      .in("status", ["Menunggu", "Disetujui"])
      .gte("request_date", activeFrom)
      .lte("request_date", activeTo)
      .order("request_date", { ascending: true })
      .limit(300),
  ]);

  if (pendingResult.error) throw mapDbError(pendingResult.error, "memuat antrean lembur");
  if (historyResult.error) throw mapDbError(historyResult.error, "memuat riwayat lembur");
  if (activeResult.error) throw mapDbError(activeResult.error, "memuat lembur aktif");

  const pendingRows = (pendingResult.data ?? []) as OvertimeRow[];
  const historyRows = (historyResult.data ?? []) as OvertimeRow[];
  const activeRows = (activeResult.data ?? []) as OvertimeRow[];
  const allRows = [...pendingRows, ...historyRows, ...activeRows];
  const [employees, histories, actorNames] = await Promise.all([
    loadEmployees(allRows.map((row) => row.employee_id)),
    loadHistory([...pendingRows, ...historyRows].map((row) => row.id)),
    loadActorNames(allRows.flatMap((row) => [row.decided_by, row.cancelled_by])),
  ]);

  const mapRow = (row: OvertimeRow) =>
    toRequest(
      row,
      employees.get(row.employee_id),
      histories.get(row.id) ?? [],
      actorNames
    );

  return {
    todayIso,
    pending: pendingRows.map(mapRow),
    history: historyRows.map(mapRow),
    active: activeRows.map(mapRow),
  };
}

export async function createOvertimeRequest(input: OvertimeInput): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "submit_overtime_request",
    {
      p_request_date: input.requestDate,
      p_start_time: input.startTime,
      p_end_time: input.endTime,
      p_work_description: input.workDescription,
    }
  );
  if (error) throw mapRpcError(error);
}

export async function cancelOwnOvertimeRequest(id: string): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "cancel_overtime_request",
    { p_request_id: id }
  );
  if (error) throw mapRpcError(error);
}

export async function decideOvertimeRequest(
  id: string,
  decision: "Disetujui" | "Ditolak",
  approvedMinutes: number | null,
  reason: string
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "decide_overtime_request",
    {
      p_request_id: id,
      p_decision: decision,
      p_approved_minutes: approvedMinutes,
      p_reason: reason || null,
    }
  );
  if (error) throw mapRpcError(error);
}

export async function cancelApprovedOvertimeRequest(
  id: string,
  reason: string
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "cancel_approved_overtime_request",
    { p_request_id: id, p_reason: reason }
  );
  if (error) throw mapRpcError(error);
}
