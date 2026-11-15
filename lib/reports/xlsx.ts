/** Pembuat workbook XLSX laporan. Semua ekspor read-only. */

import ExcelJS from "exceljs";
import { formatDateID } from "@/lib/datetime";
import { sourceLabel, type ReportData } from "@/lib/recruitment/reports/model";
import type { ReportApplicationRow } from "@/lib/recruitment/live/reports";
import type {
  AttendanceReportData,
  EmployeeExportData,
  HrContractRow,
  HrDocumentRow,
  HrReportData,
  PayrollReportData,
  PerformanceReportData,
} from "@/lib/reports/types";

export type BuiltWorkbook = { buffer: Buffer; rowCount: number };

const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF1F1A1C" },
};

/** Cegah formula injection: teks berawalan =, +, -, @ dipaksa menjadi teks. */
export function safeCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

const safeRow = (values: (string | number | null)[]) =>
  values.map((value) =>
    typeof value === "string" ? safeCell(value) : value
  );

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  rows: (string | number | null)[][]
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow(headers.map(safeCell));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  for (const row of rows) sheet.addRow(safeRow(row));
  sheet.columns.forEach((column, index) => {
    column.width = index === 0 ? 28 : 20;
  });
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(headers.length, 1) },
  };
  return rows.length;
}

async function finish(workbook: ExcelJS.Workbook, rowCount: number) {
  return {
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    rowCount,
  };
}

export async function buildHrReportXlsx(
  data: HrReportData
): Promise<BuiltWorkbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAMAQU HRIS";
  let count = 0;
  count += addSheet(workbook, "Ringkasan", ["Metrik", "Nilai"], [
    ["Tanggal acuan", formatDateID(data.referenceDate)],
    ["Karyawan Aktif", data.counts.active],
    ["Karyawan Probation", data.counts.probation],
    ["Karyawan Nonaktif", data.counts.inactive],
    ["Karyawan baru bulan ini", data.counts.newThisMonth],
    ["Karyawan keluar bulan ini", data.counts.leftThisMonth],
  ]);
  count += addSheet(
    workbook,
    "Per Departemen",
    ["Departemen", "Total", "Aktif", "Probation", "Nonaktif"],
    data.byDepartment.map((row) => [
      row.department,
      row.total,
      row.active,
      row.probation,
      row.inactive,
    ])
  );
  count += addSheet(
    workbook,
    "Per Status",
    ["Status", "Jumlah"],
    data.byStatus.map((row) => [row.status, row.total])
  );
  count += addSheet(
    workbook,
    "Tipe Kerja",
    ["Tipe Kerja", "Jumlah"],
    data.byEmploymentType.map((row) => [row.employmentType, row.total])
  );
  count += addSheet(
    workbook,
    "12 Bulan",
    ["Bulan", "Karyawan Baru", "Karyawan Keluar"],
    data.monthly.map((row) => [
      formatDateID(row.monthStart),
      row.newCount,
      row.leftCount,
    ])
  );
  const contracts: { bucket: string; row: HrContractRow }[] = [
    ...data.contracts.d30.map((row) => ({ bucket: "≤ 30 hari", row })),
    ...data.contracts.d60.map((row) => ({ bucket: "31–60 hari", row })),
    ...data.contracts.d90.map((row) => ({ bucket: "61–90 hari", row })),
  ];
  count += addSheet(
    workbook,
    "Kontrak Berakhir",
    ["Rentang", "Nama Karyawan", "Departemen", "Tanggal Berakhir"],
    contracts.map(({ bucket, row }) => [
      bucket,
      row.employeeName,
      row.department,
      formatDateID(row.endDate),
    ])
  );
  const documents: { status: string; row: HrDocumentRow }[] = [
    ...data.documents.expiring.map((row) => ({
      status: "Akan kedaluwarsa",
      row,
    })),
    ...data.documents.expired.map((row) => ({ status: "Sudah lewat", row })),
  ];
  count += addSheet(
    workbook,
    "Dokumen",
    ["Status", "Nama Karyawan", "Departemen", "Jenis", "Judul", "Berlaku Sampai"],
    documents.map(({ status, row }) => [
      status,
      row.employeeName,
      row.department,
      row.docType,
      row.title,
      formatDateID(row.validUntil),
    ])
  );
  return finish(workbook, count);
}

export async function buildAttendanceReportXlsx(
  data: AttendanceReportData
): Promise<BuiltWorkbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAMAQU HRIS";
  let count = 0;
  const totals = data.rows.reduce(
    (acc, row) => ({
      present: acc.present + row.present,
      lateCount: acc.lateCount + row.lateCount,
      lateMinutes: acc.lateMinutes + row.lateMinutes,
      alfa: acc.alfa + row.alfa,
      cuti: acc.cuti + row.cuti,
      izin: acc.izin + row.izin,
      overtime: acc.overtime + row.overtimeApprovedMinutes,
    }),
    {
      present: 0,
      lateCount: 0,
      lateMinutes: 0,
      alfa: 0,
      cuti: 0,
      izin: 0,
      overtime: 0,
    }
  );
  count += addSheet(workbook, "Ringkasan", ["Metrik", "Nilai"], [
    ["Periode", data.month],
    ["Dari", formatDateID(data.period.from)],
    ["Sampai", formatDateID(data.period.to)],
    ["Karyawan", data.rows.length],
    ["Total Hadir", totals.present],
    ["Terlambat (kali)", totals.lateCount],
    ["Terlambat (menit)", totals.lateMinutes],
    ["Alfa", totals.alfa],
    ["Cuti", totals.cuti],
    ["Izin", totals.izin],
    ["Lembur Disetujui (menit)", totals.overtime],
  ]);
  count += addSheet(
    workbook,
    "Per Karyawan",
    [
      "Employee ID",
      "Nama Karyawan",
      "Departemen",
      "Hari Kerja",
      "Hadir",
      "Terlambat (kali)",
      "Terlambat (menit)",
      "Alfa",
      "Cuti",
      "Izin",
      "Lembur Disetujui (menit)",
    ],
    data.rows.map((row) => [
      row.employeeId,
      row.employeeName,
      row.department,
      row.workdays,
      row.present,
      row.lateCount,
      row.lateMinutes,
      row.alfa,
      row.cuti,
      row.izin,
      row.overtimeApprovedMinutes,
    ])
  );
  count += addSheet(
    workbook,
    "Per Departemen",
    [
      "Departemen",
      "Karyawan",
      "Hari Kerja",
      "Hadir",
      "Terlambat (kali)",
      "Terlambat (menit)",
      "Alfa",
      "Cuti",
      "Izin",
      "Lembur Disetujui (menit)",
    ],
    data.departments.map((row) => [
      row.department,
      row.employees,
      row.workdays,
      row.present,
      row.lateCount,
      row.lateMinutes,
      row.alfa,
      row.cuti,
      row.izin,
      row.overtimeApprovedMinutes,
    ])
  );
  return finish(workbook, count);
}

export async function buildPayrollReportXlsx(
  data: PayrollReportData
): Promise<BuiltWorkbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAMAQU HRIS";
  let count = 0;
  if (data.totals) {
    count += addSheet(workbook, "Ringkasan", ["Metrik", "Nilai"], [
      ["Jumlah Karyawan", data.totals.employeeCount],
      ["Total Bruto", data.totals.grossTotal],
      ["Total Potongan", data.totals.deductionTotal],
      ["Total PPh 21", data.totals.pph21Total],
      ["Total Take Home Pay", data.totals.takeHomeTotal],
      ["Total Biaya Perusahaan", data.totals.employerCostTotal],
    ]);
    count += addSheet(
      workbook,
      "Per Departemen",
      [
        "Departemen",
        "Karyawan",
        "Bruto",
        "Potongan",
        "PPh 21",
        "Take Home Pay",
        "Biaya Perusahaan",
      ],
      data.departments.map((row) => [
        row.department,
        row.employees,
        row.grossTotal,
        row.deductionTotal,
        row.pph21Total,
        row.takeHomeTotal,
        row.employerCostTotal,
      ])
    );
    if (data.bpjs) {
      count += addSheet(
        workbook,
        "BPJS",
        ["Komponen", "Bagian Karyawan", "Bagian Perusahaan"],
        [
          [
            "BPJS Kesehatan",
            data.bpjs.kesehatanEmployee,
            data.bpjs.kesehatanEmployer,
          ],
          ["JHT", data.bpjs.jhtEmployee, data.bpjs.jhtEmployer],
          ["JP", data.bpjs.jpEmployee, data.bpjs.jpEmployer],
          ["JKK", null, data.bpjs.jkkEmployer],
          ["JKM", null, data.bpjs.jkmEmployer],
        ]
      );
    }
  }
  return finish(workbook, count);
}

export async function buildPerformanceReportXlsx(
  data: PerformanceReportData
): Promise<BuiltWorkbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAMAQU HRIS";
  let count = 0;
  count += addSheet(workbook, "Ringkasan", ["Metrik", "Nilai"], [
    ["Lembar Final", data.counts.final],
    ["Lembar Dikirim", data.counts.dikirim],
    ["Lembar Tidak lengkap", data.counts.tidakLengkap],
    ["Lembar Dikecualikan", data.counts.dikecualikan],
    ["Rata-rata Skor Akhir", data.averageScore],
  ]);
  count += addSheet(
    workbook,
    "Per Aspek",
    ["Aspek", "Deskripsi", "Rata-rata", "Jumlah Dinilai"],
    data.aspects.map((row) => [
      row.aspectName,
      row.aspectDescription,
      row.averageScore,
      row.scoredCount,
    ])
  );
  count += addSheet(
    workbook,
    "Per Departemen",
    [
      "Departemen",
      "Final",
      "Rata-rata",
      "Sangat Baik",
      "Baik",
      "Cukup",
      "Perlu Perbaikan",
    ],
    data.departments.map((row) => [
      row.department,
      row.finalCount,
      row.averageScore,
      row.sangatBaik,
      row.baik,
      row.cukup,
      row.perluPerbaikan,
    ])
  );
  count += addSheet(
    workbook,
    "Karyawan",
    ["Employee ID", "Nama Karyawan", "Departemen", "Skor Akhir", "Kategori"],
    data.employees.map((row) => [
      row.employeeId,
      row.employeeName,
      row.department,
      row.finalScore,
      row.finalCategory,
    ])
  );
  return finish(workbook, count);
}

export async function buildEmployeeExportXlsx(
  data: EmployeeExportData
): Promise<BuiltWorkbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAMAQU HRIS";
  const count = addSheet(
    workbook,
    "Daftar Karyawan",
    [
      "Employee ID",
      "Nama",
      "Departemen",
      "Jabatan",
      "Atasan",
      "Status",
      "Tipe Kerja",
      "Lokasi",
      "Tanggal Bergabung",
    ],
    data.rows.map((row) => [
      row.employeeId,
      row.fullName,
      row.department,
      row.position,
      row.managerName,
      row.status,
      row.employmentType,
      row.location,
      formatDateID(row.joinedAt),
    ])
  );
  return finish(workbook, count);
}

export async function buildRecruitmentReportXlsx(
  data: ReportData,
  applications: ReportApplicationRow[] = []
): Promise<BuiltWorkbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAMAQU HRIS";
  let count = 0;
  count += addSheet(workbook, "Ringkasan", ["Metrik", "Nilai"], [
    ["Total Pelamar", data.summary.total],
    ["Sedang Diproses", data.summary.inProgress],
    ["Diterima", data.summary.accepted],
    ["Ditolak", data.summary.rejected],
  ]);
  count += addSheet(
    workbook,
    "Funnel",
    ["Tahap", "Jumlah"],
    data.funnel.map((row) => [row.stage, row.count])
  );
  count += addSheet(
    workbook,
    "Sumber Pelamar",
    ["Sumber", "Jumlah"],
    data.sources.map((row) => [sourceLabel(row.source), row.count])
  );
  count += addSheet(
    workbook,
    "Lama Proses",
    ["Tahap", "Rata-rata Hari", "Sampel"],
    data.speed.stages.map((row) => [
      row.stage,
      row.avgDays,
      row.sample,
    ])
  );
  count += addSheet(
    workbook,
    "Per Lowongan",
    [
      "Lowongan",
      "Total",
      "Sedang Diproses",
      "Diterima",
      "Ditolak",
    ],
    data.perJob.map((row) => [
      row.title,
      row.total,
      row.inProgress,
      row.accepted,
      row.rejected,
    ])
  );
  count += addSheet(
    workbook,
    "Tren Mingguan",
    ["Minggu", "Jumlah"],
    data.trend.map((row) => [formatDateID(row.weekStart), row.count])
  );
  if (applications.length > 0) {
    count += addSheet(
      workbook,
      "Pelamar",
      [
        "Nomor Lamaran",
        "Lowongan",
        "Tahap",
        "Sumber",
        "Tanggal Melamar",
        "Tanggal Final",
      ],
      applications.map((row) => [
        row.applicationNumber,
        row.jobTitle,
        row.stage,
        sourceLabel(row.source),
        formatDateID(row.appliedAt),
        row.finalAt ? formatDateID(row.finalAt) : "",
      ])
    );
  }
  return finish(workbook, count);
}
