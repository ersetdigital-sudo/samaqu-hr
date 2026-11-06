/**
 * Tipe domain Kontrak & Masa Kerja.
 *
 * Kontrak hanya menyimpan referensi Employee ID ke Direktori. Nama, jabatan,
 * dan departemen diambil dari data karyawan saat dibaca — tidak diduplikasi,
 * dan NIK tidak pernah ikut.
 */

import type {
  ContractDisplayStatus,
  ContractEvent,
  ContractStatus,
} from "@/lib/contracts/constants";
import type {
  EmployeeStatus,
  EmploymentType,
} from "@/lib/employees/types";

export type Contract = {
  id: string;
  contractNumber: string;
  employeeId: string;
  startDate: string;
  /** `null` untuk kontrak Tetap yang tidak dibatasi tanggal. */
  endDate: string | null;
  employmentType: EmploymentType;
  /** Status inti yang tersimpan di database (tanpa "Akan Berakhir"). */
  status: ContractStatus;
  /**
   * Status tampilan hasil perhitungan server (`deriveDisplayStatus`).
   * Tidak pernah disimpan sebagai kolom — satu sumber kebenaran tetap tanggal.
   */
  displayStatus: ContractDisplayStatus;
  /** Penanda data historis yang periodenya memang sudah bertumpang tindih. */
  historicalOverlap: boolean;
  previousContractId: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Baris tabel: data karyawan ringkas hasil join, tanpa NIK. */
export type ContractSummary = Contract & {
  employeeName: string;
  position: string;
  department: string;
};

/** Referensi karyawan untuk pemilihan kontrak baru (dari Direktori). */
export type ContractEmployeeRef = {
  id: string;
  fullName: string;
  position: string;
  department: string;
  joinedAt: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
};

export type ContractHistoryEntry = {
  id: number;
  contractId: string;
  employeeId: string;
  event: ContractEvent;
  changes: unknown;
  note: string | null;
  /** auth.uid() aktor; `null` selama autentikasi asli belum aktif. */
  changedBy: string | null;
  changedAt: string;
};

export type ContractDetail = {
  employee: ContractEmployeeRef;
  /** Semua kontrak karyawan, terbaru lebih dulu. */
  contracts: Contract[];
  /** Audit trail seluruh kontrak karyawan, terbaru lebih dulu. */
  history: ContractHistoryEntry[];
};

/** Payload pembuatan / perubahan kontrak. */
export type ContractInput = {
  employeeId: string;
  startDate: string;
  endDate: string | null;
  employmentType: EmploymentType;
  note: string | null;
  /**
   * Diisi `true` bila HR secara eksplisit menyamakan jenis hubungan kerja
   * karyawan dengan kontrak baru. Perubahan ini dicatat.
   */
  syncEmployeeType?: boolean;
};

/** Payload perpanjangan. `startDate` kosong = default server. */
export type RenewInput = {
  startDate?: string | null;
  endDate: string | null;
  note: string | null;
  /** Wajib bila tanggal mulai diubah dari default (jeda kontrak). */
  gapReason?: string | null;
};

export type ContractListResponse = {
  contracts: ContractSummary[];
  employees: ContractEmployeeRef[];
};
