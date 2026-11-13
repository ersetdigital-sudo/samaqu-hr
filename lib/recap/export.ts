/** Ekspor rekap kehadiran: matriks kolom Indonesia dan CSV. */

import { formatDateID } from "@/lib/datetime";
import type { RecapPeriod, RecapRow } from "@/lib/recap/types";

export const RECAP_EXPORT_HEADERS = [
  "Nama Karyawan",
  "Employee ID",
  "Departemen",
  "Jabatan",
  "Status Karyawan",
  "Tanggal Bergabung",
  "Akhir Masa Aktif",
  "Periode Mulai",
  "Periode Selesai",
  "Hari Kerja",
  "Hadir",
  "Terlambat (Kejadian)",
  "Terlambat (Menit)",
  "Pulang Cepat (Kejadian)",
  "Pulang Cepat (Menit)",
  "Lupa Check-out",
  "Alfa",
  "Cuti",
  "Sakit",
  "Izin",
  "Total Jam Kerja",
  "Persentase Kehadiran (%)",
  "Keterangan Masa Aktif",
] as const;

export type RecapExportCell = string | number | null;

export function buildRecapExportMatrix(
  rows: RecapRow[],
  period: RecapPeriod
): RecapExportCell[][] {
  return [
    [...RECAP_EXPORT_HEADERS],
    ...rows.map((row) => {
      const employee = row.employee;
      const inactiveNote = employee.activeEndDate
        ? `Aktif s/d ${formatDateID(employee.activeEndDate)}`
        : employee.status === "Nonaktif"
          ? "Tanggal Nonaktif tidak tercatat"
          : "";

      return [
        employee.fullName,
        employee.id,
        employee.department,
        employee.position,
        employee.status,
        formatDateID(employee.joinedAt),
        employee.activeEndDate ? formatDateID(employee.activeEndDate) : "",
        formatDateID(period.from),
        formatDateID(period.to),
        row.workdays,
        row.present,
        row.lateCount,
        row.lateMinutes,
        row.earlyCount,
        row.earlyMinutes,
        row.missingCheckout,
        row.alfa,
        row.cuti,
        row.sakit,
        row.izin,
        Number((row.workMinutes / 60).toFixed(2)),
        row.attendancePercent,
        inactiveNote,
      ];
    }),
  ];
}

const csvCell = (value: RecapExportCell): string => {
  if (value === null) return "";
  if (typeof value === "number") return String(value);

  let text = value;
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export function buildRecapCsv(rows: RecapRow[], period: RecapPeriod): string {
  const matrix = buildRecapExportMatrix(rows, period);
  return `\uFEFF${matrix
    .map((cells) => cells.map(csvCell).join(","))
    .join("\r\n")}`;
}
