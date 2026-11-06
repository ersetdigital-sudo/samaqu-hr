/**
 * Tipe domain modul Employee Management.
 *
 * `Employee.id` (format SQ-EMP-0001) adalah identitas utama lintas modul HRIS.
 * Modul lain cukup menyimpan referensi ke ID ini, bukan menyalin data karyawan.
 */

export const EMPLOYMENT_TYPES = ["Tetap", "Kontrak", "Magang", "Harian"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYEE_STATUSES = ["Aktif", "Probation", "Nonaktif"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const GENDERS = ["Laki-laki", "Perempuan"] as const;
export type Gender = (typeof GENDERS)[number];

export const DEPARTMENTS = [
  "People & Culture",
  "Customer Service",
  "Marketing",
  "Operasional",
  "Keuangan",
  "Teknologi",
] as const;

export const LOCATIONS = [
  "Bandung (On-site)",
  "Jakarta (On-site)",
  "Remote",
] as const;

export type Employee = {
  /** Primary identifier: SQ-EMP-0001, SQ-EMP-0002, ... */
  id: string;
  fullName: string;
  position: string;
  department: string;
  location: string;
  /** Employee ID atasan langsung, `null` untuk top-level. */
  managerId: string | null;
  /** Tanggal bergabung (YYYY-MM-DD). */
  joinedAt: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  gender: Gender;
  birthPlace: string;
  birthDate: string;
  address: string;
  /**
   * Data sensitif. Tidak pernah ikut di daftar/pencarian — hanya keluar lewat
   * endpoint detail (`/api/employees/[id]`) untuk role yang berhak.
   */
  nik: string;
  /** Email pribadi dan email kerja dipisah. */
  personalEmail: string;
  workEmail: string;
  phone: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  probationStart: string | null;
  probationEnd: string | null;
};

/** Baris tabel: tanpa NIK, tanpa detail kontak. */
export type EmployeeSummary = Pick<
  Employee,
  | "id"
  | "fullName"
  | "position"
  | "department"
  | "location"
  | "managerId"
  | "joinedAt"
  | "employmentType"
  | "status"
> & {
  managerName: string | null;
};

/** Detail lengkap, termasuk NIK (akses terbatas). */
export type EmployeeDetail = Employee & {
  managerName: string | null;
  /**
   * Ringkasan dari modul Kontrak & Masa Kerja — satu-satunya sumber tanggal
   * berakhir kontrak. `null` berarti kontrak Tetap tanpa batas/tidak ada.
   */
  currentContractEnd: string | null;
};

/** Payload form; `id` tidak pernah diterima dari klien. */
export type EmployeeInput = Omit<Employee, "id">;

export type EmployeeDirectoryStats = {
  totalActive: number;
  newLast30Days: number;
  probation: number;
  inactive: number;
};

export type EmployeeListResponse = {
  employees: EmployeeSummary[];
  /** Employee ID berikutnya (hanya pratinjau; server tetap penentu akhir). */
  nextId: string;
};
