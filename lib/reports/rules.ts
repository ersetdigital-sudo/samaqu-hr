/** Definisi, akses, dan format laporan (tanpa akses database). */

import type { Role } from "@/lib/navigation";
import { formatMonthYearID } from "@/lib/datetime";
import { formatRupiah } from "@/lib/payroll/rules";
import type { ReportAccessType, ReportLink } from "@/lib/reports/types";

export const MAX_EXPORT_ROWS = 10_000;

export const REPORT_TYPE_LABELS: Record<ReportAccessType, string> = {
  hr: "Laporan HR",
  recruitment: "Laporan Rekrutmen",
  attendance: "Laporan Kehadiran",
  payroll: "Laporan Payroll",
  performance: "Laporan Performance",
  employee_export: "Daftar Karyawan",
  export_history: "Riwayat Ekspor",
};

export const REPORT_LINKS: ReportLink[] = [
  {
    id: "hr",
    title: "Laporan HR",
    description:
      "Komposisi karyawan, kontrak yang berakhir, dan dokumen kedaluwarsa.",
    href: "/reports/hr",
    icon: "users",
    access: "staff",
  },
  {
    id: "rekrutmen",
    title: "Laporan Rekrutmen",
    description: "Funnel, sumber pelamar, dan lama proses rekrutmen.",
    href: "/reports/rekrutmen",
    icon: "pipe",
    access: "recruitment",
  },
  {
    id: "kehadiran",
    title: "Laporan Kehadiran",
    description: "Rekap kehadiran per karyawan dan per departemen.",
    href: "/reports/kehadiran",
    icon: "clock",
    access: "staff",
  },
  {
    id: "payroll",
    title: "Laporan Payroll",
    description: "Agregat gaji, potongan, PPh 21, BPJS, dan biaya perusahaan.",
    href: "/reports/payroll",
    icon: "wallet",
    access: "staff",
  },
  {
    id: "performance",
    title: "Laporan Performance",
    description: "Hasil penilaian Final, kategori, dan rata-rata per aspek.",
    href: "/reports/performance",
    icon: "target",
    access: "staff",
  },
  {
    id: "ekspor",
    title: "Ekspor Data",
    description: "Unduh Daftar Karyawan dengan kolom yang aman.",
    href: "/reports/ekspor",
    icon: "file",
    access: "staff",
  },
  {
    id: "riwayat-ekspor",
    title: "Riwayat Ekspor",
    description: "Audit ekspor: pengguna, filter, dan jumlah baris.",
    href: "/reports/riwayat-ekspor",
    icon: "rep",
    access: "staff",
  },
];

export function reportsForRole(role: Role | null): ReportLink[] {
  if (role === null) return [];
  if (role === "admin" || role === "hr_manager") return REPORT_LINKS;
  if (role === "recruiter") {
    return REPORT_LINKS.filter((link) => link.access === "recruitment");
  }
  return [];
}

export const formatReportMonth = (month: string): string =>
  formatMonthYearID(`${month}-01`);

export const formatMinutesAsDuration = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 menit";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest} menit`;
  return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} menit`;
};

export const formatReportDelta = (
  current: number,
  previous: number | null,
  formatter: (value: number) => string = (value) =>
    new Intl.NumberFormat("id-ID").format(value)
): string => {
  if (previous === null) return "Tidak ada pembanding";
  const diff = current - previous;
  if (Math.abs(diff) < 0.005) return "Sama dengan periode sebelumnya";
  const percent =
    previous > 0 ? Math.round((Math.abs(diff) / previous) * 100) : null;
  return `${diff > 0 ? "Naik" : "Turun"} ${formatter(Math.abs(diff))}${
    percent !== null ? ` (${percent}%)` : ""
  }`;
};

export const formatReportDeltaRupiah = (
  current: number,
  previous: number | null
): string => formatReportDelta(current, previous, formatRupiah);

export const attendanceTotals = (
  rows: {
    workdays: number;
    present: number;
    lateCount: number;
    lateMinutes: number;
    alfa: number;
    cuti: number;
    izin: number;
    overtimeApprovedMinutes: number;
  }[]
) => ({
  workdays: rows.reduce((sum, row) => sum + row.workdays, 0),
  present: rows.reduce((sum, row) => sum + row.present, 0),
  lateCount: rows.reduce((sum, row) => sum + row.lateCount, 0),
  lateMinutes: rows.reduce((sum, row) => sum + row.lateMinutes, 0),
  alfa: rows.reduce((sum, row) => sum + row.alfa, 0),
  cuti: rows.reduce((sum, row) => sum + row.cuti, 0),
  izin: rows.reduce((sum, row) => sum + row.izin, 0),
  overtimeApprovedMinutes: rows.reduce(
    (sum, row) => sum + row.overtimeApprovedMinutes,
    0
  ),
});
