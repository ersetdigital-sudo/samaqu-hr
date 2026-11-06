/**
 * Lapisan akses data Kontrak & Masa Kerja (server-side).
 *
 * Satu-satunya tempat query tabel `contracts` / `contract_history`.
 * Nama, jabatan, dan departemen selalu diambil dari `employees` (referensi
 * Employee ID), tidak disalin ke tabel kontrak. NIK tidak pernah dibaca.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import {
  defaultRenewalStart,
  deriveDisplayStatus,
  validateContractInput,
  findOverlap,
} from "@/lib/contracts/rules";
import { parseIsoDate } from "@/lib/employees/format";
import type {
  Contract,
  ContractDetail,
  ContractEmployeeRef,
  ContractHistoryEntry,
  ContractInput,
  ContractSummary,
  RenewInput,
} from "@/lib/contracts/types";
import type {
  ContractEvent,
  ContractStatus,
} from "@/lib/contracts/constants";
import type {
  EmployeeStatus,
  EmploymentType,
} from "@/lib/employees/types";

export class ContractDataError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string>;

  constructor(
    message: string,
    status = 400,
    errors?: Record<string, string>
  ) {
    super(message);
    this.name = "ContractDataError";
    this.status = status;
    this.errors = errors;
  }
}

type ContractRow = {
  id: string;
  contract_number: string;
  employee_id: string;
  start_date: string;
  end_date: string | null;
  employment_type: EmploymentType;
  status: ContractStatus;
  historical_overlap: boolean;
  previous_contract_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type HistoryRow = {
  id: number;
  contract_id: string;
  employee_id: string;
  event: ContractEvent;
  changes: unknown;
  note: string | null;
  changed_by: string | null;
  changed_at: string;
};

type EmployeeOptionRow = {
  id: string;
  full_name: string;
  position: string;
  department: string;
  joined_at: string;
  employment_type: EmploymentType;
  status: EmployeeStatus;
};

const EMPLOYEE_OPTION_COLUMNS =
  "id, full_name, position, department, joined_at, employment_type, status";

const toContract = (row: ContractRow): Contract => ({
  id: row.id,
  contractNumber: row.contract_number,
  employeeId: row.employee_id,
  startDate: row.start_date,
  endDate: row.end_date,
  employmentType: row.employment_type,
  status: row.status,
  displayStatus: deriveDisplayStatus({
    status: row.status,
    endDate: row.end_date,
  }),
  historicalOverlap: row.historical_overlap,
  previousContractId: row.previous_contract_id,
  note: row.note,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toEmployeeRef = (row: EmployeeOptionRow): ContractEmployeeRef => ({
  id: row.id,
  fullName: row.full_name,
  position: row.position,
  department: row.department,
  joinedAt: row.joined_at,
  employmentType: row.employment_type,
  status: row.status,
});

const toHistory = (row: HistoryRow): ContractHistoryEntry => ({
  id: row.id,
  contractId: row.contract_id,
  employeeId: row.employee_id,
  event: row.event,
  changes: row.changes,
  note: row.note,
  changedBy: row.changed_by,
  changedAt: row.changed_at,
});

const mapDbError = (error: { code?: string; message?: string }, action: string) => {
  if (error.code === "42501") {
    return new ContractDataError("Akses ditolak oleh aturan keamanan data", 403);
  }
  if (error.code === "23P01") {
    return new ContractDataError(
      "Periode kontrak bertumpang tindih dengan kontrak Aktif lain milik karyawan ini",
      409
    );
  }
  if (error.code === "23505") {
    return new ContractDataError("Nomor kontrak sudah dipakai", 409);
  }
  if (error.code === "23503") {
    return new ContractDataError("Karyawan tidak ditemukan di Direktori", 404);
  }
  if (error.code === "23514" || error.code === "23502") {
    return new ContractDataError(
      "Data kontrak tidak lolos validasi database (periksa tanggal dan jenis kontrak)",
      400
    );
  }
  return new ContractDataError(`Gagal ${action} kontrak`, 500);
};

const mapRpcError = (error: { message?: string; code?: string }) => {
  const message =
    error.message?.replace(/^.*?:\s*/, "") || "Gagal memperpanjang kontrak";

  if (error.code === "42501") return new ContractDataError(message, 403);
  if (error.code === "P0002") return new ContractDataError(message, 404);
  if (error.code === "23P01") {
    return new ContractDataError(
      "Periode perpanjangan bertumpang tindih dengan kontrak Aktif lain milik karyawan ini",
      409
    );
  }
  return new ContractDataError(message, 409);
};

export async function listContractEmployeeOptions(): Promise<
  ContractEmployeeRef[]
> {
  const { data, error } = await (await getServerSupabase())
    .from("employees")
    .select(EMPLOYEE_OPTION_COLUMNS)
    .order("full_name", { ascending: true });

  if (error) throw mapDbError(error, "memuat data karyawan");
  return ((data ?? []) as EmployeeOptionRow[]).map(toEmployeeRef);
}

const findEmployee = async (
  employeeId: string
): Promise<ContractEmployeeRef | null> => {
  const { data, error } = await (await getServerSupabase())
    .from("employees")
    .select(EMPLOYEE_OPTION_COLUMNS)
    .eq("id", employeeId)
    .maybeSingle();

  if (error) throw mapDbError(error, "memuat karyawan");
  return data ? toEmployeeRef(data as EmployeeOptionRow) : null;
};

export async function listContractSummaries(): Promise<ContractSummary[]> {
  const supabase = (await getServerSupabase());
  const [contractResult, employeeResult] = await Promise.all([
    supabase.from("contracts").select("*").order("end_date", {
      ascending: true,
      nullsFirst: false,
    }),
    supabase.from("employees").select(EMPLOYEE_OPTION_COLUMNS),
  ]);

  if (contractResult.error) {
    throw mapDbError(contractResult.error, "memuat daftar");
  }
  if (employeeResult.error) {
    throw mapDbError(employeeResult.error, "memuat data karyawan");
  }

  const employees = new Map(
    ((employeeResult.data ?? []) as EmployeeOptionRow[]).map((row) => [
      row.id,
      row,
    ])
  );

  return ((contractResult.data ?? []) as ContractRow[]).map((row) => {
    const employee = employees.get(row.employee_id);
    return {
      ...toContract(row),
      employeeName: employee?.full_name ?? "Karyawan tidak ditemukan",
      position: employee?.position ?? "—",
      department: employee?.department ?? "—",
    };
  });
}

export async function getEmployeeContracts(
  employeeId: string
): Promise<ContractDetail | null> {
  const employee = await findEmployee(employeeId);
  if (!employee) return null;

  const supabase = (await getServerSupabase());
  const [contractResult, historyResult] = await Promise.all([
    supabase
      .from("contracts")
      .select("*")
      .eq("employee_id", employeeId)
      .order("start_date", { ascending: false }),
    supabase
      .from("contract_history")
      .select("*")
      .eq("employee_id", employeeId)
      .order("changed_at", { ascending: false }),
  ]);

  if (contractResult.error) {
    throw mapDbError(contractResult.error, "memuat riwayat");
  }
  if (historyResult.error) {
    throw mapDbError(historyResult.error, "memuat jejak perubahan");
  }

  return {
    employee,
    contracts: ((contractResult.data ?? []) as ContractRow[]).map(toContract),
    history: ((historyResult.data ?? []) as HistoryRow[]).map(toHistory),
  };
}

const listActiveContracts = async (employeeId: string) => {
  const { data, error } = await (await getServerSupabase())
    .from("contracts")
    .select("id, contract_number, start_date, end_date, status")
    .eq("employee_id", employeeId)
    .eq("status", "Aktif");

  if (error) throw mapDbError(error, "memeriksa kontrak aktif");

  return ((data ?? []) as {
    id: string;
    contract_number: string;
    start_date: string;
    end_date: string | null;
    status: ContractStatus;
  }[]).map((row) => ({
    id: row.id,
    contractNumber: row.contract_number,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
  }));
};

const assertNoOverlap = async (
  employeeId: string,
  startDate: string,
  endDate: string | null,
  ignoreId?: string
) => {
  const active = await listActiveContracts(employeeId);
  const overlap = findOverlap(active, { startDate, endDate, ignoreId });
  if (overlap) {
    throw new ContractDataError(
      `Periode bertumpang tindih dengan kontrak Aktif ${overlap.contractNumber}. ` +
        "Akhiri atau perpanjang kontrak tersebut lebih dulu.",
      409
    );
  }
};

/**
 * Menyamakan jenis hubungan kerja karyawan dengan kontrak secara eksplisit.
 *
 * Satu-satunya jalur resmi: fungsi database `sync_employee_employment_type`
 * (security definer) yang meng-update `employees` + mencatat
 * `contract_history` dalam satu transaksi. Trigger penjaga di tabel
 * `employees` menolak update langsung di luar jalur ini.
 */
const syncEmployeeEmploymentType = async (
  employeeId: string,
  from: EmploymentType,
  to: EmploymentType,
  contractId: string
) => {
  const { error } = await (await getServerSupabase()).rpc(
    "sync_employee_employment_type",
    {
      p_employee_id: employeeId,
      p_expected_type: from,
      p_new_type: to,
      p_contract_id: contractId,
      p_note: "Jenis hubungan kerja karyawan disinkronkan dengan kontrak",
    }
  );

  if (error) {
    throw new ContractDataError(
      error.message?.replace(/^.*?:\s*/, "") ||
        "Gagal menyinkronkan jenis hubungan kerja",
      error.code === "P0002" ? 404 : 409
    );
  }
};

const summaryOf = async (contractId: string): Promise<ContractSummary> => {
  const { data, error } = await (await getServerSupabase())
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();

  if (error) throw mapDbError(error, "membaca kontrak");
  if (!data) throw new ContractDataError("Kontrak tidak ditemukan", 404);

  const row = data as ContractRow;
  const employee = await findEmployee(row.employee_id);

  return {
    ...toContract(row),
    employeeName: employee?.fullName ?? "Karyawan tidak ditemukan",
    position: employee?.position ?? "—",
    department: employee?.department ?? "—",
  };
};

export async function createContract(
  input: ContractInput
): Promise<ContractSummary> {
  const employee = await findEmployee(input.employeeId);
  if (!employee) {
    throw new ContractDataError("Karyawan tidak ditemukan di Direktori", 404);
  }

  // Karyawan Nonaktif harus direaktivasi lebih dulu — status tidak diubah
  // otomatis hanya karena ada kontrak baru.
  if (employee.status === "Nonaktif") {
    throw new ContractDataError(
      `Karyawan ${employee.id} berstatus Nonaktif. Reaktivasi karyawan lebih dulu sebelum membuat kontrak baru.`,
      409
    );
  }

  const errors = validateContractInput(input, employee.employmentType);
  if (Object.keys(errors).length > 0) {
    throw new ContractDataError("Periksa kembali data kontrak", 400, errors);
  }

  await assertNoOverlap(input.employeeId, input.startDate, input.endDate);

  const { data, error } = await (await getServerSupabase())
    .from("contracts")
    .insert({
      employee_id: input.employeeId,
      start_date: input.startDate,
      end_date: input.endDate,
      employment_type: input.employmentType,
      note: input.note,
    })
    .select("*")
    .single();

  if (error) throw mapDbError(error, "menambah");

  const created = data as ContractRow;

  if (
    input.syncEmployeeType &&
    input.employmentType !== employee.employmentType
  ) {
    await syncEmployeeEmploymentType(
      employee.id,
      employee.employmentType,
      input.employmentType,
      created.id
    );
  }

  return summaryOf(created.id);
}

export async function updateContract(
  contractId: string,
  input: ContractInput
): Promise<ContractSummary> {
  const supabase = (await getServerSupabase());
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();

  if (error) throw mapDbError(error, "membaca kontrak");
  if (!data) throw new ContractDataError("Kontrak tidak ditemukan", 404);

  const existing = data as ContractRow;
  if (existing.status !== "Aktif") {
    throw new ContractDataError(
      "Kontrak yang sudah Berakhir/Diperpanjang tidak bisa diubah",
      409
    );
  }

  const employee = await findEmployee(existing.employee_id);
  if (!employee) {
    throw new ContractDataError("Karyawan tidak ditemukan di Direktori", 404);
  }

  const errors = validateContractInput(
    { ...input, employeeId: existing.employee_id },
    employee.employmentType
  );
  if (Object.keys(errors).length > 0) {
    throw new ContractDataError("Periksa kembali data kontrak", 400, errors);
  }

  await assertNoOverlap(
    existing.employee_id,
    input.startDate,
    input.endDate,
    existing.id
  );

  const { error: updateError } = await supabase
    .from("contracts")
    .update({
      start_date: input.startDate,
      end_date: input.endDate,
      employment_type: input.employmentType,
      note: input.note,
    })
    .eq("id", existing.id);

  if (updateError) throw mapDbError(updateError, "memperbarui");

  if (
    input.syncEmployeeType &&
    input.employmentType !== employee.employmentType
  ) {
    await syncEmployeeEmploymentType(
      employee.id,
      employee.employmentType,
      input.employmentType,
      existing.id
    );
  }

  return summaryOf(existing.id);
}

export async function renewContract(
  previousContractId: string,
  input: RenewInput
): Promise<ContractSummary> {
  const supabase = (await getServerSupabase());
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", previousContractId)
    .maybeSingle();

  if (error) throw mapDbError(error, "membaca kontrak");
  if (!data) throw new ContractDataError("Kontrak tidak ditemukan", 404);

  const previous = data as ContractRow;

  if (previous.status !== "Aktif") {
    throw new ContractDataError("Hanya kontrak Aktif yang bisa diperpanjang", 409);
  }

  // Kontrak Tetap tidak punya tanggal berakhir → perubahan ke/dari Tetap
  // memakai jalur perubahan jenis hubungan kerja, bukan perpanjangan.
  if (previous.employment_type === "Tetap") {
    throw new ContractDataError(
      "Kontrak Tetap tidak bisa diperpanjang. Gunakan perubahan jenis hubungan kerja bila karyawan beralih ke kontrak berjangka.",
      409
    );
  }

  const defaultStart = defaultRenewalStart(previous.end_date);
  if (!defaultStart) {
    throw new ContractDataError(
      "Kontrak sebelumnya belum punya tanggal berakhir, sehingga perpanjangan tidak bisa dihitung",
      409
    );
  }

  const startDate = input.startDate?.trim() ? input.startDate : defaultStart;
  if (!parseIsoDate(startDate)) {
    throw new ContractDataError("Tanggal mulai perpanjangan tidak valid", 400, {
      startDate: "Tanggal mulai perpanjangan tidak valid",
    });
  }

  const gapReason = input.gapReason?.trim() || null;
  if (startDate !== defaultStart && !gapReason) {
    throw new ContractDataError(
      `Tanggal mulai ${startDate} berbeda dari tanggal default ${defaultStart}. Alasan jeda kontrak wajib diisi.`,
      400,
      { gapReason: "Alasan jeda wajib diisi bila tanggal mulai diubah" }
    );
  }

  if (previous.end_date && startDate <= previous.end_date) {
    throw new ContractDataError(
      `Tanggal mulai perpanjangan harus setelah tanggal berakhir kontrak sebelumnya (${previous.end_date})`,
      400,
      { startDate: "Mulai harus setelah tanggal berakhir kontrak sebelumnya" }
    );
  }

  const { data: created, error: rpcError } = await supabase.rpc(
    "renew_contract",
    {
      p_previous_id: previousContractId,
      p_start_date: startDate,
      p_end_date: input.endDate,
      p_note: input.note,
      p_gap_reason: gapReason,
    }
  );

  if (rpcError) throw mapRpcError(rpcError);

  return summaryOf((created as ContractRow).id);
}

export async function endContract(
  contractId: string,
  endDate: string | null
): Promise<ContractSummary> {
  const supabase = (await getServerSupabase());
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();

  if (error) throw mapDbError(error, "membaca kontrak");
  if (!data) throw new ContractDataError("Kontrak tidak ditemukan", 404);

  const existing = data as ContractRow;
  if (existing.status !== "Aktif") {
    throw new ContractDataError("Kontrak ini sudah tidak aktif", 409);
  }

  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const finalEnd = endDate ?? iso;

  if (finalEnd < existing.start_date) {
    throw new ContractDataError(
      "Tanggal berakhir tidak boleh sebelum tanggal mulai",
      400
    );
  }

  const { error: updateError } = await supabase
    .from("contracts")
    .update({ status: "Berakhir", end_date: finalEnd })
    .eq("id", existing.id);

  if (updateError) throw mapDbError(updateError, "mengakhiri");

  return summaryOf(existing.id);
}
