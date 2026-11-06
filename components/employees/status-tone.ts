import type { EmployeeStatus } from "@/lib/employees/types";

/** Kelas warna badge status karyawan, mengikuti palet tag yang sudah ada. */
export const employeeStatusTone = (status: EmployeeStatus) =>
  status === "Aktif" ? "t-ok" : status === "Probation" ? "t-warn" : "t-bad";
