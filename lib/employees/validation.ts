/** Validasi form karyawan; dipakai klien dan route API. */

import { parseIsoDate } from "@/lib/employees/format";
import type { EmployeeInput } from "@/lib/employees/types";

export type EmployeeErrors = Partial<Record<keyof EmployeeInput, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIK_PATTERN = /^\d{16}$/;

export const isValidEmail = (value: string) => EMAIL_PATTERN.test(value);

const REQUIRED_TEXT: { key: keyof EmployeeInput; label: string }[] = [
  { key: "fullName", label: "Nama lengkap" },
  { key: "position", label: "Jabatan" },
  { key: "department", label: "Departemen" },
  { key: "location", label: "Lokasi kerja" },
  { key: "joinedAt", label: "Tanggal bergabung" },
  { key: "birthPlace", label: "Tempat lahir" },
  { key: "birthDate", label: "Tanggal lahir" },
  { key: "address", label: "Alamat" },
  { key: "nik", label: "NIK KTP" },
  { key: "personalEmail", label: "Email pribadi" },
  { key: "workEmail", label: "Email kerja" },
  { key: "phone", label: "Nomor HP" },
  { key: "emergencyName", label: "Nama kontak darurat" },
  { key: "emergencyRelation", label: "Hubungan kontak darurat" },
  { key: "emergencyPhone", label: "Nomor kontak darurat" },
];

export function validateEmployee(input: EmployeeInput): EmployeeErrors {
  const errors: EmployeeErrors = {};

  REQUIRED_TEXT.forEach(({ key, label }) => {
    const value = input[key];
    if (typeof value !== "string" || value.trim() === "") {
      errors[key] = `${label} wajib diisi`;
    }
  });

  if (input.nik && !NIK_PATTERN.test(input.nik)) {
    errors.nik = "NIK KTP harus 16 digit angka";
  }

  if (input.personalEmail && !EMAIL_PATTERN.test(input.personalEmail)) {
    errors.personalEmail = "Format email pribadi tidak valid";
  }

  if (input.workEmail && !EMAIL_PATTERN.test(input.workEmail)) {
    errors.workEmail = "Format email kerja tidak valid";
  }

  const probationStart = parseIsoDate(input.probationStart);
  const probationEnd = parseIsoDate(input.probationEnd);

  if (input.probationStart && !probationStart) {
    errors.probationStart = "Tanggal mulai probation tidak valid";
  }
  if (input.probationEnd && !probationEnd) {
    errors.probationEnd = "Tanggal akhir probation tidak valid";
  }
  if (
    probationStart &&
    probationEnd &&
    probationEnd.getTime() < probationStart.getTime()
  ) {
    errors.probationEnd = "Tanggal akhir probation tidak boleh sebelum mulai";
  }
  if (input.status === "Probation") {
    if (!input.probationStart) {
      errors.probationStart = "Status Probation wajib punya tanggal mulai";
    }
    if (!input.probationEnd) {
      errors.probationEnd = "Status Probation wajib punya tanggal berakhir";
    }
  }

  return errors;
}
