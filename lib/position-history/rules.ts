/**
 * Aturan murni Mutasi & Promosi: validasi, diff sebelum/sesudah, dan
 * penelusuran bawahan untuk mencegah atasan melingkar di UI.
 * Validasi final tetap di fungsi database.
 */

import {
  DEPARTMENTS,
  LOCATIONS,
  type EmployeeStatus,
} from "@/lib/employees/types";
import {
  POSITION_CHANGE_TYPES,
  type PositionChangeErrors,
  type PositionChangeInput,
  type PositionChangeType,
  type PositionEmployeeOption,
} from "@/lib/position-history/types";

export const POSITION_MAX_LENGTH = 150;
export const POSITION_REASON_MAX_LENGTH = 500;

export type PositionChangeField =
  | "position"
  | "department"
  | "manager"
  | "location";

export const POSITION_FIELD_LABELS: Record<PositionChangeField, string> = {
  position: "Jabatan",
  department: "Departemen",
  manager: "Atasan langsung",
  location: "Lokasi kerja",
};

export type PositionSnapshot = {
  oldPosition: string;
  newPosition: string;
  oldDepartment: string;
  newDepartment: string;
  oldManagerId: string | null;
  newManagerId: string | null;
  oldLocation: string;
  newLocation: string;
};

export type PositionChangeDiff = {
  field: PositionChangeField;
  label: string;
  before: string;
  after: string;
};

export const isEligiblePositionEmployee = (status: EmployeeStatus): boolean =>
  status === "Aktif" || status === "Probation";

export const normalizeManagerId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export const isPositionChangeType = (
  value: unknown
): value is PositionChangeType =>
  typeof value === "string" &&
  (POSITION_CHANGE_TYPES as readonly string[]).includes(value);

const isValidIsoDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

/** Daftar ID seluruh bawahan (transitif), aman terhadap data siklus. */
export function collectDescendantIds(
  employees: PositionEmployeeOption[],
  employeeId: string
): Set<string> {
  const children = new Map<string, string[]>();
  for (const employee of employees) {
    if (!employee.managerId) continue;
    const list = children.get(employee.managerId) ?? [];
    list.push(employee.id);
    children.set(employee.managerId, list);
  }

  const result = new Set<string>();
  const queue = [...(children.get(employeeId) ?? [])];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || result.has(id)) continue;
    result.add(id);
    queue.push(...(children.get(id) ?? []));
  }

  return result;
}

export type PositionChangeValidationOptions = {
  todayIso?: string;
  joinedAt?: string | null;
  descendantIds?: Set<string>;
};

export function validatePositionChange(
  input: PositionChangeInput,
  options: PositionChangeValidationOptions = {}
): PositionChangeErrors {
  const errors: PositionChangeErrors = {};

  if (!input.employeeId) errors.employeeId = "Pilih karyawan";
  if (!isPositionChangeType(input.changeType)) {
    errors.changeType = "Pilih jenis perubahan";
  }

  if (!isValidIsoDate(input.effectiveDate)) {
    errors.effectiveDate = "Tanggal efektif tidak valid";
  } else {
    if (options.todayIso && input.effectiveDate > options.todayIso) {
      errors.effectiveDate = "Tanggal efektif tidak boleh di masa depan";
    } else if (options.joinedAt && input.effectiveDate < options.joinedAt) {
      errors.effectiveDate =
        "Tanggal efektif tidak boleh sebelum tanggal bergabung";
    }
  }

  const reason = input.reason.trim();
  if (!reason) errors.reason = "Alasan perubahan wajib diisi";
  else if (reason.length > POSITION_REASON_MAX_LENGTH) {
    errors.reason = `Alasan maksimal ${POSITION_REASON_MAX_LENGTH} karakter`;
  }

  const position = input.newPosition.trim();
  if (!position) errors.newPosition = "Jabatan baru wajib diisi";
  else if (position.length > POSITION_MAX_LENGTH) {
    errors.newPosition = `Jabatan maksimal ${POSITION_MAX_LENGTH} karakter`;
  }

  if (!(DEPARTMENTS as readonly string[]).includes(input.newDepartment)) {
    errors.newDepartment = "Pilih departemen yang valid";
  }
  if (!(LOCATIONS as readonly string[]).includes(input.newLocation)) {
    errors.newLocation = "Pilih lokasi kerja yang valid";
  }

  if (input.newManagerId === input.employeeId) {
    errors.newManagerId = "Atasan baru tidak boleh diri sendiri";
  } else if (
    input.newManagerId &&
    options.descendantIds?.has(input.newManagerId)
  ) {
    errors.newManagerId = "Atasan baru tidak boleh bawahan dari karyawan ini";
  }

  const changed =
    position !== input.oldPosition ||
    input.newDepartment !== input.oldDepartment ||
    normalizeManagerId(input.newManagerId) !==
      normalizeManagerId(input.oldManagerId) ||
    input.newLocation !== input.oldLocation;

  if (!changed) {
    errors.form =
      "Minimal satu dari jabatan, departemen, atasan langsung, atau lokasi harus berubah.";
  }

  return errors;
}

/** Hanya field yang benar-benar berubah, dengan label siap tampil. */
export function positionChangeDiff(
  values: PositionSnapshot,
  managerName: (id: string | null) => string = (id) => id ?? "—"
): PositionChangeDiff[] {
  const diffs: PositionChangeDiff[] = [];

  if (values.oldPosition !== values.newPosition) {
    diffs.push({
      field: "position",
      label: POSITION_FIELD_LABELS.position,
      before: values.oldPosition,
      after: values.newPosition,
    });
  }

  if (values.oldDepartment !== values.newDepartment) {
    diffs.push({
      field: "department",
      label: POSITION_FIELD_LABELS.department,
      before: values.oldDepartment,
      after: values.newDepartment,
    });
  }

  if (
    normalizeManagerId(values.oldManagerId) !==
    normalizeManagerId(values.newManagerId)
  ) {
    diffs.push({
      field: "manager",
      label: POSITION_FIELD_LABELS.manager,
      before: managerName(values.oldManagerId),
      after: managerName(values.newManagerId),
    });
  }

  if (values.oldLocation !== values.newLocation) {
    diffs.push({
      field: "location",
      label: POSITION_FIELD_LABELS.location,
      before: values.oldLocation,
      after: values.newLocation,
    });
  }

  return diffs;
}
