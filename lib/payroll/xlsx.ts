/** Ekspor XLSX payroll dan daftar transfer. */

import ExcelJS from "exceljs";
import { formatDateID, formatMonthYearID } from "@/lib/datetime";
import type { PayrollRun, PayrollRunEmployee } from "@/lib/payroll/types";

const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF1F1A1C" },
};

const styleHeader = (sheet: ExcelJS.Worksheet, count: number) => {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 34;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: count },
  };
};

const fill = async (workbook: ExcelJS.Workbook) =>
  Buffer.from(await workbook.xlsx.writeBuffer());

export async function buildPayrollXlsx(
  run: PayrollRun,
  employees: PayrollRunEmployee[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAMAQU HRIS";
  const sheet = workbook.addWorksheet("Rekap Payroll", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const headers = [
    "Periode",
    "Nama Karyawan",
    "Employee ID",
    "Departemen",
    "Jabatan",
    "Hari Kerja",
    "Alfa",
    "Jam Ekuivalen Lembur",
    "Gaji Pokok",
    "Tunjangan Tetap",
    "Tunjangan Tidak Tetap",
    "Uang Lembur",
    "Pendapatan Lain",
    "Bruto",
    "BPJS Kesehatan Karyawan",
    "JHT Karyawan",
    "JP Karyawan",
    "PPh 21",
    "Potongan Alfa",
    "Potongan Keterlambatan",
    "Potongan Lain",
    "Total Potongan",
    "Take Home Pay",
    "Biaya Perusahaan",
    "Status",
  ];
  sheet.addRow(headers);
  styleHeader(sheet, headers.length);

  for (const row of employees) {
    sheet.addRow([
      formatMonthYearID(run.periodMonth + "-01"),
      row.employeeName,
      row.employeeId,
      row.department,
      row.position,
      row.workdays,
      row.alfaDays,
      Number((row.overtimeEquivalentMinutes / 60).toFixed(2)),
      row.baseSalary,
      row.fixedAllowance,
      row.variableAllowance,
      row.overtimePay,
      row.manualIncomeTotal,
      row.grossIncome,
      row.bpjsKesehatanEmployee,
      row.jhtEmployee,
      row.jpEmployee,
      row.pph21,
      row.alfaDeduction,
      row.lateDeduction,
      row.manualDeductionTotal,
      row.totalDeductions,
      row.takeHomePay,
      row.employerCost,
      row.calcStatus,
    ]);
  }

  sheet.columns.forEach((column, index) => {
    column.width = index <= 4 ? [16, 26, 16, 20, 24][index] : 16;
  });
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
    for (let col = 9; col <= 24; col += 1) {
      row.getCell(col).numFmt = '#,##0.00';
    }
  });

  return fill(workbook);
}

export async function buildPayrollTransferXlsx(
  run: PayrollRun,
  rows: {
    bankName: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
    employeeName: string;
    employeeId: string;
    takeHomePay: number;
  }[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAMAQU HRIS";
  const sheet = workbook.addWorksheet("Daftar Transfer", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const headers = [
    "Periode",
    "Bank",
    "Nama Pemilik Rekening",
    "Nomor Rekening",
    "Nama Karyawan",
    "Employee ID",
    "Nominal Transfer",
  ];
  sheet.addRow(headers);
  styleHeader(sheet, headers.length);
  for (const row of rows) {
    sheet.addRow([
      formatMonthYearID(run.periodMonth + "-01"),
      row.bankName,
      row.bankAccountHolder,
      row.bankAccountNumber,
      row.employeeName,
      row.employeeId,
      row.takeHomePay,
    ]);
  }
  sheet.columns.forEach((column, index) => {
    column.width = [16, 16, 26, 24, 26, 16, 18][index] ?? 16;
  });
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    row.getCell(7).numFmt = '#,##0.00';
  });
  return fill(workbook);
}

export function payrollExportPeriod(run: PayrollRun): string {
  return `${formatDateID(run.periodMonth)}–${formatDateID(
    run.periodMonth
  )}`;
}
