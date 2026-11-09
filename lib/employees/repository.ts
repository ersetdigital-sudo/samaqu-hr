/**
 * Lapisan akses data Employee Management (server-side) — Supabase/Postgres.
 *
 * Satu-satunya tempat query tabel `employees`. Halaman server dan route API
 * hanya memanggil fungsi di sini, sehingga perubahan skema cukup diikuti di
 * satu file. NIK tidak pernah ikut pada `listEmployeeSummaries()`.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import type {
  Employee,
  EmployeeDetail,
  EmployeeInput,
  EmployeeStatus,
  EmployeeSummary,
} from "@/lib/employees/types";

/** Error data yang aman diteruskan ke klien (pesan + status HTTP). */
export class EmployeeDataError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "EmployeeDataError";
    this.status = status;
  }
}

type SummaryRow = {
  id: string;
  full_name: string;
  position: string;
  department: string;
  location: string;
  manager_id: string | null;
  joined_at: string;
  employment_type: Employee["employmentType"];
  status: Employee["status"];
};

type EmployeeRow = SummaryRow & {
  gender: Employee["gender"];
  birth_place: string;
  birth_date: string;
  address: string;
  nik: string;
  personal_email: string;
  work_email: string;
  phone: string;
  emergency_name: string;
  emergency_relation: string;
  emergency_phone: string;
  probation_start: string | null;
  probation_end: string | null;
};

/** Kolom daftar — sengaja tanpa NIK/kontak pribadi. */
const SUMMARY_COLUMNS =
  "id, full_name, position, department, location, manager_id, joined_at, employment_type, status";

const DIRECTORY_COLUMNS = `${SUMMARY_COLUMNS},manager_name`;

const DETAIL_COLUMNS =
  "id, full_name, position, department, location, manager_id, manager_name, joined_at, employment_type, status, gender, birth_place, birth_date, address, nik, personal_email, work_email, phone, emergency_name, emergency_relation, emergency_phone, probation_start, probation_end";

type SummaryViewRow = SummaryRow & { manager_name: string | null };
type DetailViewRow = EmployeeRow & { manager_name: string | null };

const toSummary = (
  row: SummaryRow,
  managerName: string | null
): EmployeeSummary => ({
  id: row.id,
  fullName: row.full_name,
  position: row.position,
  department: row.department,
  location: row.location,
  managerId: row.manager_id,
  managerName,
  joinedAt: row.joined_at,
  employmentType: row.employment_type,
  status: row.status,
});

const toDetail = (
  row: EmployeeRow,
  managerName: string | null,
  currentContractEnd: string | null
): EmployeeDetail => ({
  ...toSummary(row, managerName),
  gender: row.gender,
  birthPlace: row.birth_place,
  birthDate: row.birth_date,
  address: row.address,
  nik: row.nik,
  personalEmail: row.personal_email,
  workEmail: row.work_email,
  phone: row.phone,
  emergencyName: row.emergency_name,
  emergencyRelation: row.emergency_relation,
  emergencyPhone: row.emergency_phone,
  probationStart: row.probation_start,
  probationEnd: row.probation_end,
  currentContractEnd,
});

/** Kolom domain → kolom tabel. `id` tidak pernah berasal dari klien. */
const toRow = (input: EmployeeInput) => ({
  full_name: input.fullName,
  position: input.position,
  department: input.department,
  location: input.location,
  manager_id: input.managerId,
  joined_at: input.joinedAt,
  employment_type: input.employmentType,
  status: input.status,
  gender: input.gender,
  birth_place: input.birthPlace,
  birth_date: input.birthDate,
  address: input.address,
  nik: input.nik,
  personal_email: input.personalEmail,
  work_email: input.workEmail,
  phone: input.phone,
  emergency_name: input.emergencyName,
  emergency_relation: input.emergencyRelation,
  emergency_phone: input.emergencyPhone,
  probation_start: input.probationStart,
  probation_end: input.probationEnd,
});

const mapDbError = (error: { code?: string }, action: string) => {
  if (error.code === "42501") {
    return new EmployeeDataError("Akses ditolak oleh aturan keamanan data", 403);
  }
  if (error.code === "23505") {
    return new EmployeeDataError(
      "NIK atau email sudah dipakai karyawan lain",
      409
    );
  }
  if (error.code === "23514" || error.code === "23502") {
    return new EmployeeDataError(
      "Data tidak lolos validasi database. Periksa tanggal probation dan field wajib.",
      400
    );
  }
  if (error.code === "23503") {
    return new EmployeeDataError("Atasan langsung tidak ditemukan", 400);
  }
  return new EmployeeDataError(`Gagal ${action} karyawan`, 500);
};

/** Error dari fungsi database (reaktivasi) — pesan sudah ramah untuk pengguna. */
const mapRpcError = (error: { message?: string; code?: string }, action: string) => {
  const message = error.message?.replace(/^.*?:\s*/, "") || `Gagal ${action}`;

  if (error.code === "42501") return new EmployeeDataError(message, 403);
  if (error.code === "P0002") return new EmployeeDataError(message, 404);
  if (error.code === "23505") {
    return new EmployeeDataError(
      "NIK atau email kerja sudah dipakai karyawan lain",
      409
    );
  }
  if (
    error.code === "P0001" ||
    error.code === "23514" ||
    error.code === "23502" ||
    error.code === "22007" ||
    error.code === "22008" ||
    error.code === "22P02"
  ) {
    return new EmployeeDataError(
      message === `Gagal ${action}`
        ? "Data karyawan tidak valid. Periksa field wajib, tanggal, dan pilihan."
        : message,
      400
    );
  }
  return new EmployeeDataError(`Gagal ${action}`, 500);
};

/** Ringkasan tanggal berakhir kontrak — sumbernya tabel contracts. */
const loadActiveContractEnd = async (
  employeeId: string
): Promise<string | null> => {
  const { data, error } = await (await getServerSupabase())
    .from("contracts")
    .select("end_date")
    .eq("employee_id", employeeId)
    .eq("status", "Aktif")
    .order("end_date", { ascending: true, nullsFirst: false })
    .limit(1);

  if (error) {
    throw new EmployeeDataError("Gagal memuat ringkasan kontrak", 500);
  }

  return (data?.[0] as { end_date: string | null } | undefined)?.end_date ?? null;
};

export async function listEmployeeSummaries(): Promise<EmployeeSummary[]> {
  const { data, error } = await (await getServerSupabase())
    .from("employee_directory")
    .select(DIRECTORY_COLUMNS)
    .order("full_name", { ascending: true });

  if (error) throw mapDbError(error, "memuat direktori");

  const rows = (data ?? []) as SummaryViewRow[];
  return rows.map((row) => toSummary(row, row.manager_name));
}

/** Detail lengkap termasuk NIK — hanya untuk role hr_manager. */
export async function getEmployeeDetail(
  id: string
): Promise<EmployeeDetail | null> {
  const db = await getServerSupabase();
  const [result, currentContractEnd] = await Promise.all([
    db.from("employee_details").select(DETAIL_COLUMNS).eq("id", id).maybeSingle(),
    loadActiveContractEnd(id),
  ]);

  if (result.error) throw mapDbError(result.error, "memuat detail");
  if (!result.data) return null;

  const row = result.data as DetailViewRow;
  return toDetail(row, row.manager_name, currentContractEnd);
}

/** Ringkasan ringan untuk respons simpan/konversi tanpa detail lengkap. */
export async function getEmployeeSummary(
  id: string
): Promise<EmployeeSummary | null> {
  const { data, error } = await (await getServerSupabase())
    .from("employee_directory")
    .select(DIRECTORY_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw mapDbError(error, "memuat ringkasan");
  if (!data) return null;

  const row = data as SummaryViewRow;
  return toSummary(row, row.manager_name);
}

/** Pratinjau Employee ID berikutnya (sequence tidak digeser). */
export async function getNextEmployeeId(): Promise<string> {
  const { data, error } = await (await getServerSupabase()).rpc("employee_id_preview");

  if (error || typeof data !== "string") {
    throw new EmployeeDataError("Gagal membuat Employee ID baru", 500);
  }

  return data;
}

export async function createEmployee(
  input: EmployeeInput
): Promise<EmployeeSummary> {
  const { data, error } = await (await getServerSupabase())
    .from("employees")
    .insert(toRow(input))
    .select(SUMMARY_COLUMNS)
    .single();

  if (error) throw mapDbError(error, "menambah");

  // Daftar langsung diperbarui dari baris ini; nama atasan menyusul lewat
  // refresh latar belakang/detail tanpa menahan respons simpan.
  return toSummary(data as SummaryRow, null);
}

/**
 * Konversi pelamar Diterima menjadi karyawan dan tautkan dalam satu transaksi
 * database. Role, tahap, dan konversi ganda diperiksa di dalam fungsi SQL.
 */
export async function convertApplicationToEmployee(
  applicationId: string,
  input: EmployeeInput
): Promise<EmployeeSummary> {
  const { data, error } = await (await getServerSupabase()).rpc(
    "convert_job_application_to_employee",
    { p_application_id: applicationId, p_employee: toRow(input) }
  );

  if (error) throw mapRpcError(error, "mengonversi pelamar");
  if (typeof data !== "string") {
    throw new EmployeeDataError(
      "Karyawan tersimpan tetapi ID karyawan tidak terbaca",
      500
    );
  }

  const summary = await getEmployeeSummary(data);
  if (!summary) {
    throw new EmployeeDataError(
      "Karyawan tersimpan tetapi gagal dibaca kembali",
      500
    );
  }

  return summary;
}

/** Peringatan lembut agar HR memeriksa kemungkinan karyawan ganda. */
export async function findEmployeeByNameAndBirthDate(
  fullName: string,
  birthDate: string
): Promise<{ id: string; fullName: string } | null> {
  const { data, error } = await (await getServerSupabase())
    .from("employees")
    .select("id, full_name")
    .ilike("full_name", fullName.trim())
    .eq("birth_date", birthDate)
    .maybeSingle();

  if (error) {
    throw new EmployeeDataError("Gagal memeriksa karyawan yang mirip", 500);
  }
  if (!data) return null;

  const row = data as { id: string; full_name: string };
  return { id: row.id, fullName: row.full_name };
}

export async function updateEmployee(
  id: string,
  input: EmployeeInput
): Promise<EmployeeSummary | null> {
  const supabase = (await getServerSupabase());

  // Jenis hubungan kerja hanya dikelola modul Kontrak. Endpoint Direktori
  // menolak perubahan apa pun, tanpa parameter bypass untuk frontend.
  const { data: current, error: readError } = await supabase
    .from("employees")
    .select("employment_type")
    .eq("id", id)
    .maybeSingle();

  if (readError) throw mapDbError(readError, "membaca karyawan");
  if (!current) return null;

  const currentType = (current as { employment_type: string }).employment_type;
  if (currentType !== input.employmentType) {
    throw new EmployeeDataError(
      "Jenis hubungan kerja hanya bisa diubah melalui modul Kontrak & Masa Kerja.",
      409
    );
  }

  const { data, error } = await supabase
    .from("employees")
    .update(toRow({ ...input, employmentType: currentType }))
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw mapDbError(error, "memperbarui");
  if (!data) return null;

  return getEmployeeSummary(id);
}

export async function updateEmployeeStatus(
  id: string,
  status: EmployeeStatus
): Promise<EmployeeSummary | null> {
  const supabase = (await getServerSupabase());

  const { data: current, error: readError } = await supabase
    .from("employees")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (readError) throw mapDbError(readError, "membaca status");
  if (!current) return null;

  const currentStatus = (current as { status: EmployeeStatus }).status;

  // Nonaktif → Aktif hanya lewat aksi Reaktivasi (alasan wajib + audit).
  if (currentStatus === "Nonaktif" && status === "Aktif") {
    throw new EmployeeDataError(
      "Gunakan aksi Reaktivasi (dengan alasan) untuk mengaktifkan kembali karyawan Nonaktif.",
      409
    );
  }

  const { data, error } = await supabase
    .from("employees")
    .update({ status })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw mapDbError(error, "mengubah status");
  if (!data) return null;

  return getEmployeeSummary(id);
}

/**
 * Reaktivasi karyawan Nonaktif. Alasan wajib; audit dicatat oleh database
 * dalam transaksi yang sama, dan tidak ada data lain yang ikut berubah.
 */
export async function reactivateEmployee(
  id: string,
  reason: string
): Promise<EmployeeSummary | null> {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new EmployeeDataError("Alasan reaktivasi wajib diisi", 400);
  }

  const { data, error } = await (await getServerSupabase()).rpc("reactivate_employee", {
    p_employee_id: id,
    p_reason: trimmed,
  });

  if (error) throw mapRpcError(error, "mereaktivasi karyawan");
  if (!data) return null;

  return getEmployeeSummary((data as { id: string }).id);
}
