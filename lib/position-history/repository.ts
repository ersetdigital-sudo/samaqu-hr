/** Lapisan akses data Mutasi & Promosi (server-side). */

import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { getOrganizationChart } from "@/lib/organization/repository";
import type { EmployeeStatus } from "@/lib/employees/types";
import type {
  PositionChangeInput,
  PositionEmployeeOption,
  PositionHistoryEntry,
} from "@/lib/position-history/types";

export class PositionHistoryDataError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string>;

  constructor(
    message: string,
    status = 400,
    errors?: Record<string, string>
  ) {
    super(message);
    this.name = "PositionHistoryDataError";
    this.status = status;
    this.errors = errors;
  }
}

type HistoryRow = {
  id: number;
  employee_id: string;
  change_type: PositionHistoryEntry["changeType"];
  effective_date: string;
  reason: string;
  old_position: string;
  new_position: string;
  old_department: string;
  new_department: string;
  old_manager_id: string | null;
  new_manager_id: string | null;
  old_location: string;
  new_location: string;
  recorded_by: string | null;
  recorded_at: string;
};

type EmployeeRow = {
  id: string;
  full_name: string;
  position: string;
  department: string;
  location: string;
  manager_id: string | null;
  status: EmployeeStatus;
  joined_at: string;
};

const HISTORY_COLUMNS =
  "id, employee_id, change_type, effective_date, reason, old_position, new_position, old_department, new_department, old_manager_id, new_manager_id, old_location, new_location, recorded_by, recorded_at";
const EMPLOYEE_COLUMNS =
  "id, full_name, position, department, location, manager_id, status, joined_at";

const mapDbError = (error: { code?: string }, action: string) => {
  if (error.code === "42501") {
    return new PositionHistoryDataError(
      "Akses ditolak oleh aturan keamanan data",
      403
    );
  }
  return new PositionHistoryDataError(`Gagal ${action} riwayat jabatan`, 500);
};

const mapRpcError = (error: { message?: string; code?: string }) => {
  const message =
    error.message?.replace(/^.*?:\s*/, "") || "Gagal mencatat perubahan";

  if (error.code === "42501") return new PositionHistoryDataError(message, 403);
  if (error.code === "P0002") return new PositionHistoryDataError(message, 404);
  if (
    error.code === "P0001" ||
    error.code === "23514" ||
    error.code === "23502" ||
    error.code === "22007" ||
    error.code === "22008" ||
    error.code === "22P02"
  ) {
    return new PositionHistoryDataError(message, 400);
  }
  if (error.code === "23503") {
    return new PositionHistoryDataError(
      "Karyawan atau atasan baru tidak ditemukan",
      400
    );
  }
  return new PositionHistoryDataError("Gagal mencatat perubahan posisi", 500);
};

const loadEmployeeMap = async () => {
  try {
    const employees = await getOrganizationChart();
    return new Map(employees.map((employee) => [employee.id, employee]));
  } catch {
    throw new PositionHistoryDataError(
      "Gagal memuat nama karyawan untuk riwayat",
      500
    );
  }
};

const loadActorNames = async (
  rows: HistoryRow[]
): Promise<{ nameById: Map<string, string>; resolved: boolean }> => {
  const ids = [
    ...new Set(
      rows
        .map((row) => row.recorded_by)
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

const toEntry = (
  row: HistoryRow,
  employeeMap: Map<string, { fullName: string }>,
  actorNames: { nameById: Map<string, string>; resolved: boolean },
  exposeActorNames: boolean
): PositionHistoryEntry => {
  const managerName = (id: string | null) =>
    id ? employeeMap.get(id)?.fullName ?? id : null;

  let recordedByName: string | null = null;
  if (row.recorded_by === null) {
    recordedByName = "Sistem";
  } else if (exposeActorNames) {
    recordedByName =
      actorNames.nameById.get(row.recorded_by) ??
      (actorNames.resolved ? "Pengguna terhapus" : "HR");
  }

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName:
      employeeMap.get(row.employee_id)?.fullName ?? "Karyawan tidak ditemukan",
    changeType: row.change_type,
    effectiveDate: row.effective_date,
    reason: row.reason,
    oldPosition: row.old_position,
    newPosition: row.new_position,
    oldDepartment: row.old_department,
    newDepartment: row.new_department,
    oldManagerId: row.old_manager_id,
    newManagerId: row.new_manager_id,
    oldManagerName: managerName(row.old_manager_id),
    newManagerName: managerName(row.new_manager_id),
    oldLocation: row.old_location,
    newLocation: row.new_location,
    recordedBy: row.recorded_by,
    recordedByName,
    recordedAt: row.recorded_at,
  };
};

async function listHistory(
  employeeId: string | null,
  exposeActorNames: boolean
): Promise<PositionHistoryEntry[]> {
  const db = await getServerSupabase();
  let request = db
    .from("employee_position_history")
    .select(HISTORY_COLUMNS)
    .order("effective_date", { ascending: false })
    .order("recorded_at", { ascending: false });

  if (employeeId) request = request.eq("employee_id", employeeId);

  const [historyResult, employeeMap] = await Promise.all([
    request,
    loadEmployeeMap(),
  ]);

  if (historyResult.error) {
    throw mapDbError(historyResult.error, "memuat");
  }

  const rows = (historyResult.data ?? []) as HistoryRow[];
  const actorNames = exposeActorNames
    ? await loadActorNames(rows)
    : { nameById: new Map<string, string>(), resolved: true };

  return rows.map((row) =>
    toEntry(row, employeeMap, actorNames, exposeActorNames)
  );
}

export async function listPositionHistory(): Promise<PositionHistoryEntry[]> {
  return listHistory(null, true);
}

export async function getEmployeePositionHistory(
  employeeId: string
): Promise<PositionHistoryEntry[]> {
  return listHistory(employeeId, true);
}

export async function listPositionEmployeeOptions(): Promise<
  PositionEmployeeOption[]
> {
  const { data, error } = await (await getServerSupabase())
    .from("employees")
    .select(EMPLOYEE_COLUMNS)
    .order("full_name", { ascending: true });

  if (error) throw mapDbError(error, "memuat data karyawan");

  return ((data ?? []) as EmployeeRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    position: row.position,
    department: row.department,
    location: row.location,
    managerId: row.manager_id,
    status: row.status,
    joinedAt: row.joined_at,
  }));
}

export async function getPositionHistoryBoard(): Promise<{
  history: PositionHistoryEntry[];
  employees: PositionEmployeeOption[];
}> {
  const [history, employees] = await Promise.all([
    listPositionHistory(),
    listPositionEmployeeOptions(),
  ]);
  return { history, employees };
}

/** Riwayat milik karyawan yang tertaut ke akun (dibaca dari database). */
export async function listMyPositionHistory(): Promise<{
  employeeId: string | null;
  employeeName: string | null;
  history: PositionHistoryEntry[];
}> {
  const db = await getServerSupabase();
  const { data: employeeId, error } = await db.rpc("current_employee_id");

  if (error) {
    throw new PositionHistoryDataError(
      "Gagal memuat data karyawan akun ini",
      500
    );
  }
  if (typeof employeeId !== "string" || employeeId === "") {
    return { employeeId: null, employeeName: null, history: [] };
  }

  const history = await listHistory(employeeId, false);
  const employeeMap = await loadEmployeeMap();

  return {
    employeeId,
    employeeName: employeeMap.get(employeeId)?.fullName ?? null,
    history,
  };
}

export async function recordPositionChange(
  input: PositionChangeInput
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "record_employee_position_change",
    {
      p_employee_id: input.employeeId,
      p_change_type: input.changeType,
      p_effective_date: input.effectiveDate,
      p_reason: input.reason,
      p_old_position: input.oldPosition,
      p_old_department: input.oldDepartment,
      p_old_manager_id: input.oldManagerId,
      p_old_location: input.oldLocation,
      p_new_position: input.newPosition,
      p_new_department: input.newDepartment,
      p_new_manager_id: input.newManagerId,
      p_new_location: input.newLocation,
    }
  );

  if (error) throw mapRpcError(error);
}
