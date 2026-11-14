/**
 * Aturan murni Payroll: pendapatan, potongan, BPJS, PPh 21 TER/Pasal 17.
 * Semua tarif dan batas berasal dari PayrollSettings yang dibaca database.
 */

import { isoWeekday, isValidIsoDate } from "@/lib/attendance/rules";
import type { HolidayEntry, WorkSchedule } from "@/lib/attendance/types";
import type { RecapEmployee, RecapPeriod, RecapRow } from "@/lib/recap/types";
import type {
  JkkRiskClass,
  LateDeductionBasis,
  LateDeductionMode,
  PayrollCalculation,
  PayrollManualItem,
  PayrollProfile,
  PayrollSettings,
  PayrollRunStatus,
  PriorPayrollYearData,
  PtkpStatus,
  TerCategory,
  TerRate,
} from "@/lib/payroll/types";
import { formatDateID } from "@/lib/datetime";

const round2 = (value: number) => Math.round(value * 100) / 100;
const round4 = (value: number) => Math.round(value * 10000) / 10000;

export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `Rp${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))}`;
}

export function formatPayrollHours(value: number): string {
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(value)} jam`;
}

export function jkkRiskClassLabel(riskClass: JkkRiskClass): string {
  switch (riskClass) {
    case "very_low":
      return "Sangat rendah";
    case "low":
      return "Rendah";
    case "medium":
      return "Sedang";
    case "high":
      return "Tinggi";
    case "very_high":
      return "Sangat tinggi";
  }
}

export function payrollRunStatusTone(status: PayrollRunStatus): string {
  switch (status) {
    case "Draft":
      return "t-warn";
    case "Final":
      return "t-ok";
    case "Dibayar":
      return "t-info";
    case "Direvisi":
      return "t-mute";
  }
}

export function payrollPeriodLabel(from: string, to: string): string {
  return `${formatDateID(from)} – ${formatDateID(to)}`;
}

export function countWorkdaysBetween(
  from: string,
  to: string,
  schedule: WorkSchedule | null,
  holidays: HolidayEntry[]
): number {
  if (!schedule || from > to) return 0;
  const holidayDates = new Set(holidays.map((holiday) => holiday.holidayDate));
  let count = 0;
  let cursor = from;
  while (cursor <= to) {
    if (schedule.workDays.includes(isoWeekday(cursor)) && !holidayDates.has(cursor)) {
      count += 1;
    }
    const [year, month, day] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}-${String(next.getUTCDate()).padStart(2, "0")}`;
  }
  return count;
}

export function shouldIncludeRecapRow(row: RecapRow): boolean {
  if (row.employee.status === "Nonaktif") return row.workdays > 0;
  return row.workdays > 0;
}

export function ptkpCategory(
  ptkpStatus: PtkpStatus | null,
  settings: PayrollSettings
): TerCategory | null {
  if (!ptkpStatus) return null;
  return settings.terCategoryMap[ptkpStatus] ?? null;
}

export function findTerRate(
  category: TerCategory,
  taxableGross: number,
  rates: TerRate[]
): TerRate | null {
  return (
    rates
      .filter((rate) => rate.category === category)
      .sort((a, b) => a.layerNo - b.layerNo)
      .find(
        (rate) =>
          rate.upTo === null || taxableGross <= rate.upTo + 0.0001
      ) ?? null
  );
}

export function progressiveTax(
  pkp: number,
  brackets: { upTo: number | null; rate: number }[]
): number {
  if (pkp <= 0) return 0;
  let lower = 0;
  let tax = 0;
  for (const bracket of [...brackets].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  })) {
    const upper = bracket.upTo ?? pkp;
    const taxable = Math.max(0, Math.min(pkp, upper) - lower);
    tax += taxable * (bracket.rate / 100);
    lower = upper;
    if (pkp <= upper) break;
  }
  return round2(tax);
}

export function alfaDeductionFor(
  proratedBase: number,
  alfaDays: number,
  divisor: number
): number {
  if (proratedBase <= 0 || alfaDays <= 0 || divisor <= 0) return 0;
  return round2(Math.min(proratedBase, (proratedBase / divisor) * alfaDays));
}

export function lateDeductionFor(input: {
  enabled: boolean;
  mode: LateDeductionMode;
  amount: number;
  basis: LateDeductionBasis;
  lateCount: number;
  lateMinutes: number;
  toleranceMinutes: number;
}): number {
  if (!input.enabled || input.amount <= 0) return 0;
  if (input.mode === "per_event") {
    return round2(input.amount * input.lateCount);
  }
  const minutes =
    input.basis === "start_time"
      ? input.lateMinutes + input.lateCount * input.toleranceMinutes
      : input.lateMinutes;
  return round2(input.amount * Math.max(0, minutes));
}

export function payrollProfileIssues(
  profile: PayrollProfile | null
): string[] {
  if (!profile) return ["Profil payroll belum ada"];
  const issues: string[] = [];
  if (profile.baseSalary <= 0) issues.push("Gaji pokok kosong");
  if (!profile.ptkpStatus) issues.push("Status PTKP kosong");
  if (!profile.bankName || !profile.bankAccountNumber) {
    issues.push("Rekening bank belum lengkap");
  }
  if (!profile.bpjsKesehatanNumber) issues.push("Nomor BPJS Kesehatan kosong");
  if (!profile.bpjsKetenagakerjaanNumber) {
    issues.push("Nomor BPJS Ketenagakerjaan kosong");
  }
  return issues;
}

export function payrollCalculationStatus(
  profile: PayrollProfile | null
): "Lengkap" | "Profil payroll belum ada" | "Gaji pokok kosong" | "PTKP kosong" {
  if (!profile) return "Profil payroll belum ada";
  if (profile.baseSalary <= 0) return "Gaji pokok kosong";
  if (!profile.ptkpStatus) return "PTKP kosong";
  return "Lengkap";
}

export function validatePayrollProfileInput(
  input: {
    baseSalary: number;
    fixedAllowance: number;
    variableAllowance: number;
    ptkpStatus: string | null;
    jkkRiskClass: string;
    effectiveDate: string;
  }
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Number.isFinite(input.baseSalary) || input.baseSalary <= 0) {
    errors.baseSalary = "Gaji pokok harus lebih dari 0.";
  }
  for (const [key, value, label] of [
    ["fixedAllowance", input.fixedAllowance, "Tunjangan tetap"],
    ["variableAllowance", input.variableAllowance, "Tunjangan tidak tetap"],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      errors[key] = `${label} tidak valid.`;
    }
  }
  if (!input.ptkpStatus) errors.ptkpStatus = "Status PTKP wajib dipilih.";
  if (
    !["very_low", "low", "medium", "high", "very_high"].includes(
      input.jkkRiskClass
    )
  ) {
    errors.jkkRiskClass = "Kelas risiko JKK tidak valid.";
  }
  if (!isValidIsoDate(input.effectiveDate)) {
    errors.effectiveDate = "Tanggal berlaku tidak valid.";
  }
  return errors;
}

export function validatePayrollSettings(
  settings: PayrollSettings
): string[] {
  const errors: string[] = [];
  const nonNegative = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0;

  if (!nonNegative(settings.bpjsKesehatan?.employerRate)) {
    errors.push("Tarif perusahaan BPJS Kesehatan tidak valid.");
  }
  if (!nonNegative(settings.bpjsKesehatan?.employeeRate)) {
    errors.push("Tarif karyawan BPJS Kesehatan tidak valid.");
  }
  if (!nonNegative(settings.jht?.employerRate) || !nonNegative(settings.jht?.employeeRate)) {
    errors.push("Tarif JHT tidak valid.");
  }
  if (!nonNegative(settings.jp?.employerRate) || !nonNegative(settings.jp?.employeeRate)) {
    errors.push("Tarif JP tidak valid.");
  }
  if (!nonNegative(settings.jkmRate)) errors.push("Tarif JKM tidak valid.");
  for (const risk of ["very_low", "low", "medium", "high", "very_high"] as const) {
    if (!nonNegative(settings.jkkRiskRates?.[risk])) {
      errors.push(`Tarif JKK ${risk} tidak valid.`);
    }
  }
  if (!Number.isFinite(settings.overtimeDivisor) || settings.overtimeDivisor <= 0) {
    errors.push("Pembagi upah lembur harus lebih dari 0.");
  }
  if (!Number.isFinite(settings.alfaDivisor) || settings.alfaDivisor <= 0) {
    errors.push("Pembagi potongan alfa harus lebih dari 0.");
  }
  if (settings.lateDeduction) {
    if (!["per_minute", "per_event"].includes(settings.lateDeduction.mode)) {
      errors.push("Mode potongan keterlambatan tidak valid.");
    }
    if (!["tolerance", "start_time"].includes(settings.lateDeduction.basis)) {
      errors.push("Basis menit terlambat tidak valid.");
    }
    if (!nonNegative(settings.lateDeduction.amount)) {
      errors.push("Nilai potongan keterlambatan tidak valid.");
    }
  }
  if (!nonNegative(settings.biayaJabatan?.rate) || !nonNegative(settings.biayaJabatan?.maxMonthly) || !nonNegative(settings.biayaJabatan?.maxYearly)) {
    errors.push("Pengaturan biaya jabatan tidak valid.");
  }
  for (const status of ["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"] as const) {
    if (!nonNegative(settings.ptkpTable?.[status])) {
      errors.push(`PTKP ${status} tidak valid.`);
    }
    if (!settings.terCategoryMap?.[status]) {
      errors.push(`Kategori TER ${status} kosong.`);
    }
  }
  if (!Array.isArray(settings.progressiveBrackets) || settings.progressiveBrackets.length === 0) {
    errors.push("Tarif progresif Pasal 17 belum diisi.");
  }
  return errors;
}

export type PayrollCalculationInput = {
  employee: RecapEmployee;
  profile: PayrollProfile | null;
  recap: RecapRow;
  settings: PayrollSettings;
  terRates: TerRate[];
  period: RecapPeriod;
  fullPeriodWorkdays: number;
  lateToleranceMinutes: number;
  manualItems: PayrollManualItem[];
  prior: PriorPayrollYearData | null;
};

export type PayrollCalculationResult = {
  status: ReturnType<typeof payrollCalculationStatus>;
  issues: string[];
  calculation: PayrollCalculation;
};

const emptyCalculation = (
  settings: PayrollSettings,
  employee: RecapEmployee,
  recap: RecapRow,
  warnings: string[]
): PayrollCalculation => ({
  baseSalaryMonthly: 0,
  fixedAllowanceMonthly: 0,
  variableAllowanceMonthly: 0,
  prorationFactor: 1,
  proratedBaseSalary: 0,
  proratedFixedAllowance: 0,
  proratedVariableAllowance: 0,
  workdays: recap.workdays,
  fullPeriodWorkdays: recap.workdays,
  alfaDays: recap.alfa,
  lateCount: recap.lateCount,
  lateMinutes: recap.lateMinutes,
  lateToleranceMinutes: 0,
  overtimeEquivalentMinutes: recap.overtimeEquivalentMinutes,
  overtimeHours: round2(recap.overtimeEquivalentMinutes / 60),
  overtimePay: 0,
  manualItems: [],
  incomeLines: [],
  deductionLines: [],
  grossIncome: 0,
  taxGross: 0,
  bpjsKesehatanEmployee: 0,
  bpjsKesehatanEmployer: 0,
  jhtEmployee: 0,
  jhtEmployer: 0,
  jpEmployee: 0,
  jpEmployer: 0,
  jkkEmployer: 0,
  jkmEmployer: 0,
  employeeBpjsTotal: 0,
  employerBpjsTotal: 0,
  alfaDeduction: 0,
  lateDeduction: 0,
  pph21: 0,
  pphMethod: "TER",
  pphTerCategory: null,
  pphTerRate: null,
  pphPrior: 0,
  pphAnnualGross: 0,
  pphAnnualBiayaJabatan: 0,
  pphAnnualEmployeeBpjs: 0,
  pphAnnualPtkp: 0,
  pphAnnualPkp: 0,
  pphAnnualTax: 0,
  pphPriorRunCount: 0,
  totalDeductions: 0,
  takeHomePay: 0,
  employerCost: 0,
  npwpMissing: false,
  warnings,
  ratesSnapshot: settings,
});

export function calculatePayrollRow(
  input: PayrollCalculationInput
): PayrollCalculationResult {
  const { employee, recap, settings, profile } = input;
  const status = payrollCalculationStatus(profile);
  const issues = payrollProfileIssues(profile);
  const warnings: string[] = [];

  if (!profile) {
    return {
      status,
      issues,
      calculation: emptyCalculation(settings, employee, recap, [
        "Profil payroll belum ada; lengkapi Profil Gaji sebelum finalisasi.",
      ]),
    };
  }

  const monthNumber = Number(input.period.month.slice(5, 7));
  const partialRange =
    employee.joinedAt > input.period.from ||
    (employee.status === "Nonaktif" &&
      Boolean(employee.activeEndDate && employee.activeEndDate < input.period.to));
  const prorationFactor =
    input.fullPeriodWorkdays > 0 && partialRange
      ? round4(Math.min(1, recap.workdays / input.fullPeriodWorkdays))
      : 1;

  const proratedBaseSalary = round2(profile.baseSalary * prorationFactor);
  const proratedFixedAllowance = round2(
    profile.fixedAllowance * prorationFactor
  );
  const proratedVariableAllowance = round2(
    profile.variableAllowance * prorationFactor
  );

  const overtimeHours = round2(recap.overtimeEquivalentMinutes / 60);
  const overtimePay = round2(
    ((profile.baseSalary + profile.fixedAllowance) /
      Math.max(settings.overtimeDivisor, 1)) *
      overtimeHours
  );

  const manualIncomeItems = input.manualItems.filter(
    (item) => item.category === "Pendapatan"
  );
  const manualDeductionItems = input.manualItems.filter(
    (item) => item.category === "Potongan"
  );
  const manualIncome = round2(
    manualIncomeItems.reduce((sum, item) => sum + item.amount, 0)
  );
  const manualDeduction = round2(
    manualDeductionItems.reduce((sum, item) => sum + item.amount, 0)
  );

  const incomeLines = [
    { label: "Gaji pokok", amount: proratedBaseSalary },
    { label: "Tunjangan tetap", amount: proratedFixedAllowance },
    { label: "Tunjangan tidak tetap", amount: proratedVariableAllowance },
    { label: "Uang lembur", amount: overtimePay },
    ...manualIncomeItems.map((item) => ({
      label: item.label,
      amount: item.amount,
      detail: item.reason,
    })),
  ].filter((line) => line.amount > 0);

  const grossIncome = round2(
    proratedBaseSalary +
      proratedFixedAllowance +
      proratedVariableAllowance +
      overtimePay +
      manualIncome
  );

  const bpjsWage = round2(proratedBaseSalary + proratedFixedAllowance);
  const healthFloor = settings.bpjsKesehatan.salaryFloor ?? 0;
  const healthCap = settings.bpjsKesehatan.salaryCap;
  const healthBaseRaw = Math.max(bpjsWage, healthFloor);
  const healthBase =
    healthCap !== null ? Math.min(healthBaseRaw, healthCap) : healthBaseRaw;
  const jpBase =
    settings.jp.salaryCap !== null
      ? Math.min(bpjsWage, settings.jp.salaryCap)
      : bpjsWage;
  const jkkRate = settings.jkkRiskRates[profile.jkkRiskClass] ?? 0;

  const bpjsKesehatanEmployee = round2(
    (healthBase * settings.bpjsKesehatan.employeeRate) / 100
  );
  const bpjsKesehatanEmployer = round2(
    (healthBase * settings.bpjsKesehatan.employerRate) / 100
  );
  const jhtEmployee = round2(
    (bpjsWage * settings.jht.employeeRate) / 100
  );
  const jhtEmployer = round2(
    (bpjsWage * settings.jht.employerRate) / 100
  );
  const jpEmployee = round2((jpBase * settings.jp.employeeRate) / 100);
  const jpEmployer = round2((jpBase * settings.jp.employerRate) / 100);
  const jkkEmployer = round2((bpjsWage * jkkRate) / 100);
  const jkmEmployer = round2((bpjsWage * settings.jkmRate) / 100);

  const employeeBpjsTotal = round2(
    bpjsKesehatanEmployee + jhtEmployee + jpEmployee
  );
  const employerBpjsTotal = round2(
    bpjsKesehatanEmployer +
      jhtEmployer +
      jpEmployer +
      jkkEmployer +
      jkmEmployer
  );

  const alfaDeduction = alfaDeductionFor(
    proratedBaseSalary,
    recap.alfa,
    settings.alfaDivisor
  );
  const lateDeduction = lateDeductionFor({
    enabled: settings.lateDeduction.enabled,
    mode: settings.lateDeduction.mode,
    amount: settings.lateDeduction.amount,
    basis: settings.lateDeduction.basis,
    lateCount: recap.lateCount,
    lateMinutes: recap.lateMinutes,
    toleranceMinutes: input.lateToleranceMinutes,
  });

  // Premi yang dibayar perusahaan dan masuk ke penghasilan bruto pajak.
  const taxGross = round2(
    grossIncome + bpjsKesehatanEmployer + jkkEmployer + jkmEmployer
  );

  let pph21 = 0;
  let pphMethod: "TER" | "Pasal 17" = "TER";
  let pphTerCategory: TerCategory | null = null;
  let pphTerRate: number | null = null;
  let pphPrior = input.prior?.pph21 ?? 0;
  let pphAnnualGross = 0;
  let pphAnnualBiayaJabatan = 0;
  let pphAnnualEmployeeBpjs = 0;
  let pphAnnualPtkp = 0;
  let pphAnnualPkp = 0;
  let pphAnnualTax = 0;
  let pphPriorRunCount = input.prior?.monthCount ?? 0;

  if (monthNumber === 12) {
    pphMethod = "Pasal 17";
    pphAnnualGross = round2(taxGross + (input.prior?.taxGross ?? 0));
    pphAnnualBiayaJabatan = round2(
      Math.min(
        (pphAnnualGross * settings.biayaJabatan.rate) / 100,
        settings.biayaJabatan.maxYearly
      )
    );
    pphAnnualEmployeeBpjs = round2(
      jhtEmployee +
        jpEmployee +
        (input.prior?.jhtEmployee ?? 0) +
        (input.prior?.jpEmployee ?? 0)
    );
    pphAnnualPtkp = profile.ptkpStatus
      ? settings.ptkpTable[profile.ptkpStatus] ?? 0
      : 0;
    pphAnnualPkp = Math.max(
      0,
      Math.floor(
        (pphAnnualGross -
          pphAnnualBiayaJabatan -
          pphAnnualEmployeeBpjs -
          pphAnnualPtkp) /
          1000
      ) * 1000
    );
    pphAnnualTax = progressiveTax(
      pphAnnualPkp,
      settings.progressiveBrackets
    );
    pph21 = round2(Math.max(0, pphAnnualTax - pphPrior));

    const joinMonth = Number(employee.joinedAt.slice(5, 7));
    const expectedPriorMonths =
      Number(employee.joinedAt.slice(0, 4)) <
      Number(input.period.month.slice(0, 4))
        ? 11
        : Math.max(0, 12 - joinMonth);
    if (pphPriorRunCount < expectedPriorMonths) {
      warnings.push(
        `Riwayat PPh Januari–November belum lengkap (${pphPriorRunCount} dari ${expectedPriorMonths} run). Perhitungan Desember hanya memakai data yang tersedia.`
      );
    }
  } else {
    pphTerCategory = ptkpCategory(profile.ptkpStatus, settings);
    const ter = pphTerCategory
      ? findTerRate(pphTerCategory, taxGross, input.terRates)
      : null;
    if (!ter) {
      warnings.push(
        "Tarif TER untuk kategori PTKP ini tidak ditemukan. PPh 21 dihitung 0 dan perlu diperiksa."
      );
      pphTerRate = null;
    } else {
      pphTerRate = ter.ratePercent;
      pph21 = round2((taxGross * ter.ratePercent) / 100);
    }
  }

  const npwpMissing = !profile.npwp;
  if (npwpMissing) {
    warnings.push(
      "NPWP belum diisi. Sistem hanya menandai; pemotongan tarif lebih tinggi tidak diterapkan otomatis sampai aturannya diverifikasi."
    );
  }
  if (status !== "Lengkap") {
    warnings.push(...issues);
  }

  const deductionLines = [
    { label: "BPJS Kesehatan (karyawan)", amount: bpjsKesehatanEmployee },
    { label: "JHT (karyawan)", amount: jhtEmployee },
    { label: "JP (karyawan)", amount: jpEmployee },
    { label: "PPh 21", amount: pph21 },
    { label: "Potongan alfa", amount: alfaDeduction },
    { label: "Potongan keterlambatan", amount: lateDeduction },
    ...manualDeductionItems.map((item) => ({
      label: item.label,
      amount: item.amount,
      detail: item.reason,
    })),
  ].filter((line) => line.amount > 0);

  const totalDeductions = round2(
    employeeBpjsTotal +
      pph21 +
      alfaDeduction +
      lateDeduction +
      manualDeduction
  );
  const takeHomePay = round2(grossIncome - totalDeductions);
  const employerCost = round2(grossIncome + employerBpjsTotal);

  if (takeHomePay < 0) {
    warnings.push("Take home pay negatif; periksa potongan manual dan komponen gaji.");
  }

  return {
    status,
    issues,
    calculation: {
      baseSalaryMonthly: profile.baseSalary,
      fixedAllowanceMonthly: profile.fixedAllowance,
      variableAllowanceMonthly: profile.variableAllowance,
      prorationFactor,
      proratedBaseSalary,
      proratedFixedAllowance,
      proratedVariableAllowance,
      workdays: recap.workdays,
      fullPeriodWorkdays: input.fullPeriodWorkdays,
      alfaDays: recap.alfa,
      lateCount: recap.lateCount,
      lateMinutes: recap.lateMinutes,
      lateToleranceMinutes: input.lateToleranceMinutes,
      overtimeEquivalentMinutes: recap.overtimeEquivalentMinutes,
      overtimeHours,
      overtimePay,
      manualItems: input.manualItems,
      incomeLines,
      deductionLines,
      grossIncome,
      taxGross,
      bpjsKesehatanEmployee,
      bpjsKesehatanEmployer,
      jhtEmployee,
      jhtEmployer,
      jpEmployee,
      jpEmployer,
      jkkEmployer,
      jkmEmployer,
      employeeBpjsTotal,
      employerBpjsTotal,
      alfaDeduction,
      lateDeduction,
      pph21,
      pphMethod,
      pphTerCategory,
      pphTerRate,
      pphPrior,
      pphAnnualGross,
      pphAnnualBiayaJabatan,
      pphAnnualEmployeeBpjs,
      pphAnnualPtkp,
      pphAnnualPkp,
      pphAnnualTax,
      pphPriorRunCount,
      totalDeductions,
      takeHomePay,
      employerCost,
      npwpMissing,
      warnings,
      ratesSnapshot: settings,
    },
  };
}

export type PayrollRunTotals = {
  employeeCount: number;
  grossTotal: number;
  deductionTotal: number;
  takeHomeTotal: number;
  employerCostTotal: number;
  warnings: string[];
};

export function buildPayrollRunTotals(
  results: { calculation: PayrollCalculation; status: string }[]
): PayrollRunTotals {
  return {
    employeeCount: results.length,
    grossTotal: round2(
      results.reduce((sum, result) => sum + result.calculation.grossIncome, 0)
    ),
    deductionTotal: round2(
      results.reduce(
        (sum, result) => sum + result.calculation.totalDeductions,
        0
      )
    ),
    takeHomeTotal: round2(
      results.reduce((sum, result) => sum + result.calculation.takeHomePay, 0)
    ),
    employerCostTotal: round2(
      results.reduce((sum, result) => sum + result.calculation.employerCost, 0)
    ),
    warnings: results.flatMap((result) =>
      result.status === "Lengkap" ? [] : [result.status]
    ),
  };
}
