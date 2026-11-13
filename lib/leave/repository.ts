/** Lapisan akses data Cuti & Izin (server-side). */

import "server-only";
import { randomUUID } from "node:crypto";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { isoDateJakarta } from "@/lib/datetime";
import { monthRange } from "@/lib/attendance/rules";
import type { HolidayEntry, WorkSchedule } from "@/lib/attendance/types";
import type { EmployeeStatus } from "@/lib/employees/types";
import {
  LEAVE_ATTACHMENT_BUCKET,
  leaveAttachmentExtension,
  sanitizeLeaveAttachmentName,
} from "@/lib/leave/validation";
import type {
  LeaveApprovalData,
  LeaveAttachmentMime,
  LeaveBalance,
  LeaveBalanceData,
  LeaveCalendarData,
  LeaveCalendarEntry,
  LeaveCategory,
  LeaveDecision,
  LeaveEmployee,
  LeaveEmployeeData,
  LeaveFieldErrors,
  LeaveHistoryEntry,
  LeaveRequest,
  LeaveRequestInput,
  LeaveType,
} from "@/lib/leave/types";

export class LeaveDataError extends Error {
  readonly status: number;
  readonly errors?: LeaveFieldErrors;

  constructor(message: string, status = 400, errors?: LeaveFieldErrors) {
    super(message);
    this.name = "LeaveDataError";
    this.status = status;
    this.errors = errors;
  }
}

type LeaveTypeRow = {
  code: string;
  name: string;
  category: LeaveCategory;
  description: string | null;
  counts_calendar_days: boolean;
  deducts_annual_balance: boolean;
  annual_entitlement: number | null;
  quota_days: number | null;
  requires_reason: boolean;
  requires_event_note: boolean;
  requires_doctor_note_after_workdays: number | null;
  allow_past_days: number;
  sort_order: number;
  is_active: boolean;
};

type LeaveRequestRow = {
  id: string;
  employee_id: string;
  leave_type_code: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  event_note: string | null;
  status: LeaveRequest["status"];
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_mime: LeaveAttachmentMime | null;
  submitted_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_kind: "Karyawan" | "HR" | null;
  cancellation_reason: string | null;
};

type LeaveHistoryRow = {
  id: number;
  request_id: string;
  action: LeaveHistoryEntry["action"];
  from_status: LeaveRequest["status"] | null;
  to_status: LeaveRequest["status"] | null;
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

type BalanceRow = {
  employee_id: string;
  full_name: string;
  department: string;
  job_position: string;
  status: EmployeeStatus;
  joined_at: string;
  entitlement: number;
  used: number;
  remaining: number;
  eligible: boolean;
  eligible_date: string;
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

const TYPE_COLUMNS =
  "code, name, category, description, counts_calendar_days, deducts_annual_balance, annual_entitlement, quota_days, requires_reason, requires_event_note, requires_doctor_note_after_workdays, allow_past_days, sort_order, is_active";
const REQUEST_COLUMNS =
  "id, employee_id, leave_type_code, start_date, end_date, days_count, reason, event_note, status, attachment_path, attachment_name, attachment_size, attachment_mime, submitted_at, decided_at, decided_by, decision_note, cancelled_at, cancelled_by, cancellation_kind, cancellation_reason";
const HISTORY_COLUMNS =
  "id, request_id, action, from_status, to_status, reason, actor_id, acted_at";
const EMPLOYEE_COLUMNS =
  "id, full_name, position, department, status, joined_at";

const normalizeTime = (value: string): string => value.slice(0, 5);

const mapDbError = (error: { code?: string }, action: string) => {
  if (error.code === "42501") {
    return new LeaveDataError("Akses ditolak oleh aturan keamanan data", 403);
  }
  return new LeaveDataError(`Gagal ${action} data cuti`, 500);
};

const mapRpcError = (error: { message?: string; code?: string }) => {
  const message =
    error.message?.replace(/^.*?:\s*/, "") || "Gagal memproses pengajuan cuti";
  if (error.code === "42501") return new LeaveDataError(message, 403);
  if (error.code === "P0002") return new LeaveDataError(message, 404);
  if (
    error.code === "P0001" ||
    error.code === "23514" ||
    error.code === "23502" ||
    error.code === "22P02" ||
    error.code === "22007" ||
    error.code === "22008"
  ) {
    return new LeaveDataError(message, 400);
  }
  return new LeaveDataError("Gagal memproses pengajuan cuti", 500);
};

const toType = (row: LeaveTypeRow): LeaveType => ({
  code: row.code,
  name: row.name,
  category: row.category,
  description: row.description,
  countsCalendarDays: row.counts_calendar_days,
  deductsAnnualBalance: row.deducts_annual_balance,
  annualEntitlement: row.annual_entitlement,
  quotaDays: row.quota_days,
  requiresReason: row.requires_reason,
  requiresEventNote: row.requires_event_note,
  requiresDoctorNoteAfterWorkdays: row.requires_doctor_note_after_workdays,
  allowPastDays: row.allow_past_days,
  sortOrder: row.sort_order,
  isActive: row.is_active,
});

const toEmployee = (row: EmployeeRow): LeaveEmployee => ({
  id: row.id,
  fullName: row.full_name,
  position: row.position,
  department: row.department,
  status: row.status,
  joinedAt: row.joined_at,
});

const toBalance = (row: BalanceRow): LeaveBalance => ({
  employeeId: row.employee_id,
  fullName: row.full_name,
  department: row.department,
  jobPosition: row.job_position,
  status: row.status,
  joinedAt: row.joined_at,
  entitlement: row.entitlement,
  used: row.used,
  remaining: row.remaining,
  eligible: row.eligible,
  eligibleDate: row.eligible_date,
});

const toHistory = (
  row: LeaveHistoryRow,
  actorNames: { nameById: Map<string, string>; resolved: boolean }
): LeaveHistoryEntry => ({
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

const toAttachment = (row: LeaveRequestRow) =>
  row.attachment_name && row.attachment_size && row.attachment_mime
    ? {
        fileName: row.attachment_name,
        fileSize: row.attachment_size,
        mimeType: row.attachment_mime,
      }
    : null;

const toRequest = (
  row: LeaveRequestRow,
  employee: LeaveEmployee | undefined,
  type: LeaveType | undefined,
  history: LeaveHistoryEntry[],
  actorNames: { nameById: Map<string, string>; resolved: boolean }
): LeaveRequest => ({
  id: row.id,
  employeeId: row.employee_id,
  employeeName: employee?.fullName ?? "Karyawan tidak ditemukan",
  employeePosition: employee?.position ?? "—",
  employeeDepartment: employee?.department ?? "—",
  leaveTypeCode: row.leave_type_code,
  leaveTypeName: type?.name ?? row.leave_type_code,
  leaveTypeCategory: type?.category ?? "special",
  startDate: row.start_date,
  endDate: row.end_date,
  daysCount: row.days_count,
  reason: row.reason,
  eventNote: row.event_note,
  status: row.status,
  attachment: toAttachment(row),
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

const loadActorNames = async (
  userIds: (string | null)[]
): Promise<{ nameById: Map<string, string>; resolved: boolean }> => {
  const ids = [
    ...new Set(userIds.filter((id): id is string => Boolean(id))),
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

const loadTypes = async (): Promise<LeaveType[]> => {
  const { data, error } = await (await getServerSupabase())
    .from("leave_types")
    .select(TYPE_COLUMNS)
    .order("sort_order", { ascending: true });

  if (error) throw mapDbError(error, "memuat jenis cuti");
  return ((data ?? []) as LeaveTypeRow[]).map(toType);
};

const loadSchedule = async (employeeId?: string): Promise<WorkSchedule | null> => {
  const db = await getServerSupabase();
  let query = db
    .from("work_schedules")
    .select(
      "id, employee_id, name, work_days, start_time, end_time, break_minutes, late_tolerance_minutes, is_active"
    )
    .eq("is_active", true)
    .order("employee_id", { ascending: true, nullsFirst: false })
    .limit(1);

  if (employeeId) {
    query = query.or(`employee_id.eq.${employeeId},employee_id.is.null`);
  } else {
    query = query.is("employee_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw mapDbError(error, "memuat jadwal kerja");
  if (!data) return null;

  const row = data as ScheduleRow;
  return {
    id: row.id,
    employeeId: row.employee_id,
    name: row.name,
    workDays: (row.work_days ?? []).map(Number).sort((a, b) => a - b),
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    breakMinutes: row.break_minutes,
    lateToleranceMinutes: row.late_tolerance_minutes,
    isActive: row.is_active,
  };
};

const loadHolidays = async (): Promise<HolidayEntry[]> => {
  const { data, error } = await (await getServerSupabase())
    .from("holidays")
    .select("id, holiday_date, name")
    .order("holiday_date", { ascending: true });

  if (error) throw mapDbError(error, "memuat kalender libur");
  return ((data ?? []) as HolidayRow[]).map((row) => ({
    id: row.id,
    holidayDate: row.holiday_date,
    name: row.name,
  }));
};

const loadBalances = async (year: number): Promise<LeaveBalance[]> => {
  const { data, error } = await (await getServerSupabase()).rpc(
    "leave_balances",
    { p_year: year }
  );
  if (error) throw mapRpcError(error);
  return ((data ?? []) as BalanceRow[]).map(toBalance);
};

const loadEmployees = async (
  ids: string[]
): Promise<Map<string, LeaveEmployee>> => {
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

const loadHistory = async (
  requestIds: string[]
): Promise<Map<string, LeaveHistoryEntry[]>> => {
  const grouped = new Map<string, LeaveHistoryEntry[]>();
  if (requestIds.length === 0) return grouped;

  const { data, error } = await (await getServerSupabase())
    .from("leave_request_history")
    .select(HISTORY_COLUMNS)
    .in("request_id", requestIds)
    .order("acted_at", { ascending: true });
  if (error) throw mapDbError(error, "memuat riwayat keputusan");

  const rows = (data ?? []) as LeaveHistoryRow[];
  const actorNames = await loadActorNames(rows.map((row) => row.actor_id));

  for (const row of rows) {
    const list = grouped.get(row.request_id) ?? [];
    list.push(toHistory(row, actorNames));
    grouped.set(row.request_id, list);
  }
  return grouped;
};

const loadRequestActors = async (
  rows: LeaveRequestRow[]
): Promise<{ nameById: Map<string, string>; resolved: boolean }> =>
  loadActorNames(rows.flatMap((row) => [row.decided_by, row.cancelled_by]));

const toCalendarEntry = (
  row: LeaveRequestRow,
  employee: LeaveEmployee | undefined,
  type: LeaveType | undefined
): LeaveCalendarEntry => ({
  id: row.id,
  employeeId: row.employee_id,
  employeeName: employee?.fullName ?? "Karyawan tidak ditemukan",
  employeeDepartment: employee?.department ?? "—",
  leaveTypeName: type?.name ?? row.leave_type_code,
  leaveTypeCategory: type?.category ?? "special",
  startDate: row.start_date,
  endDate: row.end_date,
  daysCount: row.days_count,
  status: row.status,
});

export async function getMyLeaveData(year?: number): Promise<LeaveEmployeeData> {
  const db = await getServerSupabase();
  const todayIso = isoDateJakarta();
  const selectedYear = year ?? Number(todayIso.slice(0, 4));

  const [types, schedule, holidays, employeeIdResult] = await Promise.all([
    loadTypes(),
    loadSchedule(),
    loadHolidays(),
    db.rpc("current_employee_id"),
  ]);

  if (employeeIdResult.error) {
    throw new LeaveDataError("Gagal memuat identitas karyawan", 500);
  }

  const employeeId =
    typeof employeeIdResult.data === "string" && employeeIdResult.data !== ""
      ? employeeIdResult.data
      : null;

  if (!employeeId) {
    return {
      linked: false,
      employee: null,
      todayIso,
      year: selectedYear,
      balance: null,
      types,
      requests: [],
      schedule,
      holidays,
    };
  }

  const employeeResult = await db
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .eq("id", employeeId)
    .maybeSingle();
  if (employeeResult.error) {
    throw mapDbError(employeeResult.error, "memuat karyawan");
  }

  const requestResult = await db
    .from("leave_requests")
    .select(REQUEST_COLUMNS)
    .eq("employee_id", employeeId)
    .order("submitted_at", { ascending: false })
    .limit(100);
  if (requestResult.error) {
    throw mapDbError(requestResult.error, "memuat pengajuan");
  }

  const requestRows = (requestResult.data ?? []) as LeaveRequestRow[];
  const [balances, histories] = await Promise.all([
    loadBalances(selectedYear),
    loadHistory(requestRows.map((row) => row.id)),
  ]);
  const actorNames = await loadRequestActors(requestRows);
  const employee = employeeResult.data
    ? toEmployee(employeeResult.data as EmployeeRow)
    : null;

  return {
    linked: true,
    employee,
    todayIso,
    year: selectedYear,
    balance: balances.find((balance) => balance.employeeId === employeeId) ?? null,
    types,
    requests: requestRows.map((row) =>
      toRequest(
        row,
        employee ?? undefined,
        types.find((type) => type.code === row.leave_type_code),
        histories.get(row.id) ?? [],
        actorNames
      )
    ),
    schedule: await loadSchedule(employeeId),
    holidays,
  };
}

export async function uploadLeaveAttachment(
  employeeId: string,
  file: File,
  mimeType: LeaveAttachmentMime
): Promise<{ path: string; fileName: string }> {
  const path = `${employeeId}/${randomUUID()}.${leaveAttachmentExtension(
    mimeType
  )}`;
  const upload = await getServiceSupabase()
    .storage.from(LEAVE_ATTACHMENT_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: mimeType,
      upsert: false,
    });

  if (upload.error) {
    throw new LeaveDataError(
      "Lampiran gagal diunggah ke penyimpanan. Coba lagi.",
      502
    );
  }

  return {
    path,
    fileName:
      sanitizeLeaveAttachmentName(file.name) ||
      `lampiran.${leaveAttachmentExtension(mimeType)}`,
  };
}

export async function removeLeaveAttachment(path: string): Promise<void> {
  const removed = await getServiceSupabase()
    .storage.from(LEAVE_ATTACHMENT_BUCKET)
    .remove([path]);
  if (removed.error) {
    console.error("[leave] Gagal menghapus lampiran storage", path);
  }
}

export async function createLeaveRequest(
  input: LeaveRequestInput,
  attachment: {
    path: string;
    fileName: string;
    mimeType: LeaveAttachmentMime;
    size: number;
  } | null
): Promise<void> {
  try {
    const { error } = await (await getServerSupabase()).rpc(
      "submit_leave_request",
      {
        p_leave_type_code: input.leaveTypeCode,
        p_start_date: input.startDate,
        p_end_date: input.endDate,
        p_reason: input.reason || null,
        p_event_note: input.eventNote || null,
        p_attachment_path: attachment?.path ?? null,
        p_attachment_name: attachment?.fileName ?? null,
        p_attachment_size: attachment?.size ?? null,
        p_attachment_mime: attachment?.mimeType ?? null,
      }
    );

    if (error) throw mapRpcError(error);
  } catch (error) {
    if (attachment) await removeLeaveAttachment(attachment.path);
    throw error;
  }
}

export async function cancelOwnLeaveRequest(id: string): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "cancel_leave_request",
    { p_request_id: id }
  );
  if (error) throw mapRpcError(error);
}

export async function decideLeaveRequest(
  id: string,
  decision: LeaveDecision,
  reason: string
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "decide_leave_request",
    { p_request_id: id, p_decision: decision, p_reason: reason || null }
  );
  if (error) throw mapRpcError(error);
}

export async function cancelApprovedLeaveRequest(
  id: string,
  reason: string
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "cancel_approved_leave_request",
    { p_request_id: id, p_reason: reason }
  );
  if (error) throw mapRpcError(error);
}

export async function getLeaveApprovalData(
  year?: number
): Promise<LeaveApprovalData> {
  const db = await getServerSupabase();
  const todayIso = isoDateJakarta();
  const selectedYear = year ?? Number(todayIso.slice(0, 4));
  const activeFloor = new Date(Date.parse(`${todayIso}T00:00:00Z`));
  activeFloor.setUTCDate(activeFloor.getUTCDate() - 180);
  const activeFrom = activeFloor.toISOString().slice(0, 10);

  const [types, pendingResult, historyResult, activeResult, balances] =
    await Promise.all([
      loadTypes(),
      db
        .from("leave_requests")
        .select(REQUEST_COLUMNS)
        .eq("status", "Menunggu")
        .order("start_date", { ascending: true })
        .limit(200),
      db
        .from("leave_requests")
        .select(REQUEST_COLUMNS)
        .neq("status", "Menunggu")
        .order("submitted_at", { ascending: false })
        .limit(200),
      db
        .from("leave_requests")
        .select(REQUEST_COLUMNS)
        .in("status", ["Menunggu", "Disetujui"])
        .gte("end_date", activeFrom)
        .order("start_date", { ascending: true })
        .limit(500),
      loadBalances(selectedYear),
    ]);

  if (pendingResult.error) {
    throw mapDbError(pendingResult.error, "memuat antrean cuti");
  }
  if (historyResult.error) {
    throw mapDbError(historyResult.error, "memuat riwayat cuti");
  }
  if (activeResult.error) {
    throw mapDbError(activeResult.error, "memuat kalender cuti");
  }

  const pendingRows = (pendingResult.data ?? []) as LeaveRequestRow[];
  const historyRows = (historyResult.data ?? []) as LeaveRequestRow[];
  const activeRows = (activeResult.data ?? []) as LeaveRequestRow[];
  const allRows = [...pendingRows, ...historyRows, ...activeRows];
  const employeeIds = allRows.map((row) => row.employee_id);

  const [employees, histories] = await Promise.all([
    loadEmployees(employeeIds),
    loadHistory([...pendingRows, ...historyRows].map((row) => row.id)),
  ]);
  const actorNames = await loadRequestActors(allRows);

  const mapRequest = (row: LeaveRequestRow) =>
    toRequest(
      row,
      employees.get(row.employee_id),
      types.find((type) => type.code === row.leave_type_code),
      histories.get(row.id) ?? [],
      actorNames
    );

  return {
    todayIso,
    year: selectedYear,
    types,
    pending: pendingRows.map(mapRequest),
    history: historyRows.map(mapRequest),
    balances,
    activeLeaves: activeRows.map((row) =>
      toCalendarEntry(
        row,
        employees.get(row.employee_id),
        types.find((type) => type.code === row.leave_type_code)
      )
    ),
  };
}

export async function getLeaveBalances(
  year?: number
): Promise<LeaveBalanceData> {
  const todayIso = isoDateJakarta();
  const selectedYear = year ?? Number(todayIso.slice(0, 4));
  return {
    todayIso,
    year: selectedYear,
    balances: await loadBalances(selectedYear),
  };
}

export async function getLeaveCalendar(
  month: string
): Promise<LeaveCalendarData> {
  const db = await getServerSupabase();
  const todayIso = isoDateJakarta();
  const { from, to } = monthRange(month);

  const [typeRows, requestResult] = await Promise.all([
    loadTypes(),
    db
      .from("leave_requests")
      .select(REQUEST_COLUMNS)
      .in("status", ["Menunggu", "Disetujui"])
      .lte("start_date", to)
      .gte("end_date", from)
      .order("start_date", { ascending: true })
      .limit(300),
  ]);

  if (requestResult.error) {
    throw mapDbError(requestResult.error, "memuat kalender cuti");
  }

  const rows = (requestResult.data ?? []) as LeaveRequestRow[];
  const employees = await loadEmployees(rows.map((row) => row.employee_id));

  return {
    todayIso,
    month,
    entries: rows.map((row) =>
      toCalendarEntry(
        row,
        employees.get(row.employee_id),
        typeRows.find((type) => type.code === row.leave_type_code)
      )
    ),
  };
}

export async function getLeaveAttachmentSignedUrl(
  id: string,
  role: "admin" | "hr_manager" | "recruiter" | "employee",
  download: boolean
): Promise<string> {
  const db = await getServerSupabase();
  const { data, error } = await db
    .from("leave_requests")
    .select("employee_id, attachment_path, attachment_name")
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapDbError(error, "membaca lampiran");
  if (!data) throw new LeaveDataError("Pengajuan tidak ditemukan", 404);

  const row = data as {
    employee_id: string;
    attachment_path: string | null;
    attachment_name: string | null;
  };
  if (!row.attachment_path) {
    throw new LeaveDataError("Pengajuan ini tidak memiliki lampiran", 404);
  }

  if (role === "employee") {
    const { data: ownEmployeeId, error: ownershipError } = await db.rpc(
      "current_employee_id"
    );
    if (ownershipError || ownEmployeeId !== row.employee_id) {
      throw new LeaveDataError("Akses ditolak", 403);
    }
  }

  const signed = await getServiceSupabase()
    .storage.from(LEAVE_ATTACHMENT_BUCKET)
    .createSignedUrl(
      row.attachment_path,
      60,
      download && row.attachment_name
        ? { download: row.attachment_name }
        : undefined
    );

  if (signed.error) {
    throw new LeaveDataError("Gagal membuka lampiran cuti", 502);
  }
  return signed.data.signedUrl;
}
