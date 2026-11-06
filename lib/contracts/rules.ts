/**
 * Aturan bisnis kontrak — fungsi murni, tanpa akses data/UI.
 *
 * Dipakai bersama oleh repository (validasi server), API, dan form klien
 * supaya hasil validasi konsisten.
 */

import {
  EXPIRING_SOON_DAYS,
  type ContractDisplayStatus,
} from "@/lib/contracts/constants";
import type { Contract, ContractInput } from "@/lib/contracts/types";
import { isoFromDate, parseIsoDate } from "@/lib/employees/format";
import type { EmploymentType } from "@/lib/employees/types";

export type ContractErrors = Partial<
  Record<keyof ContractInput, string>
>;

const DAY_MS = 86_400_000;

export const startOfToday = (now: Date = new Date()) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate());

export const daysUntil = (
  iso: string,
  now: Date = new Date()
): number => {
  const date = parseIsoDate(iso);
  if (!date) return Number.NaN;
  return Math.round(
    (date.getTime() - startOfToday(now).getTime()) / DAY_MS
  );
};

/**
 * Kontrak dianggap "Akan Berakhir" bila masih Aktif dan sisa waktunya
 * <= 30 hari. Status tersimpan tidak diubah — ini turunan untuk tampilan.
 */
export function deriveDisplayStatus(
  contract: Pick<Contract, "status" | "endDate">,
  now: Date = new Date()
): ContractDisplayStatus {
  if (contract.status !== "Aktif") {
    return contract.status === "Diperpanjang" ? "Diperpanjang" : "Berakhir";
  }
  if (!contract.endDate) return "Aktif";

  const remaining = daysUntil(contract.endDate, now);
  if (Number.isNaN(remaining)) return "Aktif";
  if (remaining < 0) return "Berakhir";
  if (remaining <= EXPIRING_SOON_DAYS) return "Akan Berakhir";
  return "Aktif";
}

export const isExpiringWithin = (
  contract: Pick<Contract, "status" | "endDate">,
  days: number,
  now: Date = new Date()
): boolean => {
  if (contract.status !== "Aktif" || !contract.endDate) return false;
  const remaining = daysUntil(contract.endDate, now);
  return remaining >= 0 && remaining <= days;
};

const monthsBetween = (from: Date, to: Date): number => {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  return to.getDate() < from.getDate() ? Math.max(0, months - 1) : Math.max(0, months);
};

/** "2 tahun 3 bulan" / "5 bulan" / "0 bulan". */
export function formatMonthSpan(months: number): string {
  if (months <= 0) return "0 bulan";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} tahun`);
  if (rest > 0 || years === 0) parts.push(`${rest} bulan`);
  return parts.join(" ");
}

/** Durasi kontrak; kontrak tanpa tanggal berakhir = "Tanpa batas". */
export function contractDurationLabel(
  contract: Pick<Contract, "startDate" | "endDate">,
  now: Date = new Date()
): string {
  const start = parseIsoDate(contract.startDate);
  if (!start) return "—";
  if (!contract.endDate) return "Tanpa batas";

  const end = parseIsoDate(contract.endDate);
  if (!end) return "—";

  return formatMonthSpan(monthsBetween(start, end) + 1);
}

/** Masa kerja sejak tanggal bergabung sampai hari ini. */
export function tenureLabel(
  joinedAt: string,
  now: Date = new Date()
): string {
  const start = parseIsoDate(joinedAt);
  if (!start) return "—";
  return formatMonthSpan(monthsBetween(start, startOfToday(now)) + 1);
}

/**
 * Tumpang tindih periode. `null` pada endDate berarti tak terbatas, sehingga
 * kontrak Tetap aktif memblokir kontrak aktif lain mulai tanggal berapa pun.
 */
export function periodsOverlap(
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null
): boolean {
  const aStartDate = parseIsoDate(aStart);
  const aEndDate = aEnd ? parseIsoDate(aEnd) : null;
  const bStartDate = parseIsoDate(bStart);
  const bEndDate = bEnd ? parseIsoDate(bEnd) : null;

  if (!aStartDate || !bStartDate) return false;

  const aEndTime = aEndDate ? aEndDate.getTime() : Number.POSITIVE_INFINITY;
  const bEndTime = bEndDate ? bEndDate.getTime() : Number.POSITIVE_INFINITY;

  return (
    aStartDate.getTime() <= bEndTime && bStartDate.getTime() <= aEndTime
  );
}

/** Cari kontrak aktif lain yang tumpang tindih dengan periode baru. */
export function findOverlap(
  contracts: Pick<Contract, "id" | "contractNumber" | "startDate" | "endDate" | "status">[],
  candidate: { startDate: string; endDate: string | null; ignoreId?: string }
): Pick<Contract, "id" | "contractNumber"> | null {
  const hit = contracts.find(
    (contract) =>
      contract.status === "Aktif" &&
      contract.id !== candidate.ignoreId &&
      periodsOverlap(
        candidate.startDate,
        candidate.endDate,
        contract.startDate,
        contract.endDate
      )
  );
  return hit ?? null;
}

/**
 * Tanggal mulai default perpanjangan: sehari setelah kontrak lama berakhir.
 * `null` bila kontrak lama tidak punya tanggal berakhir.
 */
export function defaultRenewalStart(endDate: string | null): string | null {
  const end = parseIsoDate(endDate);
  if (!end) return null;
  return isoFromDate(
    new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
  );
}

const isValidIso = (iso: string | null) => Boolean(iso && parseIsoDate(iso));

export function validateContractInput(
  input: ContractInput,
  employeeEmploymentType?: EmploymentType
): ContractErrors {
  const errors: ContractErrors = {};

  if (!input.employeeId.trim()) {
    errors.employeeId = "Karyawan wajib dipilih dari Direktori";
  }
  if (!isValidIso(input.startDate)) {
    errors.startDate = "Tanggal mulai kontrak wajib dan harus valid";
  }
  if (input.endDate !== null && !isValidIso(input.endDate)) {
    errors.endDate = "Tanggal berakhir kontrak tidak valid";
  }

  const start = parseIsoDate(input.startDate);
  const end = input.endDate ? parseIsoDate(input.endDate) : null;
  if (start && end && end.getTime() < start.getTime()) {
    errors.endDate = "Tanggal berakhir tidak boleh sebelum tanggal mulai";
  }

  // Kontrak Tetap tidak dibatasi tanggal; tanggal akhir yang ikut terkirim
  // hampir selalu kecelakaan form, jadi ditolak eksplisit.
  if (input.employmentType === "Tetap" && input.endDate) {
    errors.endDate =
      "Kontrak Tetap tidak memakai tanggal berakhir. Kosongkan tanggal atau ubah jenis hubungan kerja.";
  }

  if (input.employmentType !== "Tetap" && !input.endDate) {
    errors.endDate =
      "Kontrak jenis non-Tetap wajib memiliki tanggal berakhir";
  }

  if (
    employeeEmploymentType &&
    input.employmentType !== employeeEmploymentType &&
    !input.syncEmployeeType
  ) {
    errors.employmentType =
      `Jenis hubungan kerja karyawan saat ini ${employeeEmploymentType}. ` +
      "Centang sinkronisasi untuk mengubahnya secara tercatat.";
  }

  return errors;
}
