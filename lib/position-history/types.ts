/** Tipe domain Mutasi & Promosi. */

import type { EmployeeStatus } from "@/lib/employees/types";

export const POSITION_CHANGE_TYPES = [
  "Promosi",
  "Mutasi",
  "Demosi",
] as const;

export type PositionChangeType = (typeof POSITION_CHANGE_TYPES)[number];

/** Karyawan + nilai posisi terkini, untuk dialog dan pilihan atasan. */
export type PositionEmployeeOption = {
  id: string;
  fullName: string;
  position: string;
  department: string;
  location: string;
  managerId: string | null;
  status: EmployeeStatus;
  joinedAt: string;
};

export type PositionHistoryEntry = {
  id: number;
  employeeId: string;
  employeeName: string;
  changeType: PositionChangeType;
  effectiveDate: string;
  reason: string;
  oldPosition: string;
  newPosition: string;
  oldDepartment: string;
  newDepartment: string;
  oldManagerId: string | null;
  newManagerId: string | null;
  oldManagerName: string | null;
  newManagerName: string | null;
  oldLocation: string;
  newLocation: string;
  recordedBy: string | null;
  /** Null untuk tampilan karyawan; nama pelaku hanya dibuka untuk HR/Admin. */
  recordedByName: string | null;
  recordedAt: string;
};

export type PositionChangeInput = {
  employeeId: string;
  changeType: PositionChangeType;
  effectiveDate: string;
  reason: string;
  oldPosition: string;
  oldDepartment: string;
  oldManagerId: string | null;
  oldLocation: string;
  newPosition: string;
  newDepartment: string;
  newManagerId: string | null;
  newLocation: string;
};

export type PositionChangeErrors = Record<string, string>;
