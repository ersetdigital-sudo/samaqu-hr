/** Tipe domain Payroll. */

export const PAYROLL_RUN_STATUSES = [
  "Draft",
  "Final",
  "Dibayar",
  "Direvisi",
] as const;
export type PayrollRunStatus = (typeof PAYROLL_RUN_STATUSES)[number];

export const PTKP_STATUSES = [
  "TK/0",
  "TK/1",
  "TK/2",
  "TK/3",
  "K/0",
  "K/1",
  "K/2",
  "K/3",
] as const;
export type PtkpStatus = (typeof PTKP_STATUSES)[number];

export const JKK_RISK_CLASSES = [
  "very_low",
  "low",
  "medium",
  "high",
  "very_high",
] as const;
export type JkkRiskClass = (typeof JKK_RISK_CLASSES)[number];

export type TerCategory = "A" | "B" | "C";

export type LateDeductionMode = "per_minute" | "per_event";
export type LateDeductionBasis = "tolerance" | "start_time";

export type PayrollSettings = {
  bpjsKesehatan: {
    employerRate: number;
    employeeRate: number;
    salaryCap: number | null;
    salaryFloor: number | null;
  };
  jht: { employerRate: number; employeeRate: number };
  jp: { employerRate: number; employeeRate: number; salaryCap: number | null };
  jkkRiskRates: Record<JkkRiskClass, number>;
  jkmRate: number;
  overtimeDivisor: number;
  alfaDivisor: number;
  lateDeduction: {
    enabled: boolean;
    mode: LateDeductionMode;
    amount: number;
    basis: LateDeductionBasis;
  };
  biayaJabatan: {
    rate: number;
    maxMonthly: number;
    maxYearly: number;
  };
  ptkpTable: Record<PtkpStatus, number>;
  progressiveBrackets: { upTo: number | null; rate: number }[];
  terCategoryMap: Record<PtkpStatus, TerCategory>;
  sourceNotes: {
    ter: string;
    jp: string;
    bpjs: string;
    general: string;
  };
};

export type PayrollSettingsData = {
  settings: PayrollSettings;
  effectiveDate: string;
  updatedAt: string | null;
  updatedByName: string | null;
  history: PayrollSettingsHistoryEntry[];
};

export type PayrollSettingsHistoryEntry = {
  id: number;
  oldSettings: Record<string, unknown> | null;
  newSettings: Record<string, unknown>;
  effectiveDate: string;
  reason: string;
  changedByName: string;
  changedAt: string;
};

export type TerRate = {
  category: TerCategory;
  layerNo: number;
  upTo: number | null;
  ratePercent: number;
};

export type PayrollProfile = {
  employeeId: string;
  baseSalary: number;
  fixedAllowance: number;
  variableAllowance: number;
  ptkpStatus: PtkpStatus | null;
  npwp: string | null;
  bpjsKesehatanNumber: string | null;
  bpjsKetenagakerjaanNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  jkkRiskClass: JkkRiskClass;
  effectiveDate: string;
  notes: string | null;
  updatedAt: string;
};

export type PayrollEmployeeRef = {
  id: string;
  fullName: string;
  department: string;
  position: string;
  status: string;
  joinedAt: string;
};

export type PayrollProfileRecord = {
  profile: PayrollProfile | null;
  employee: PayrollEmployeeRef;
  issues: string[];
  history: PayrollProfileHistoryEntry[];
};

export type PayrollProfileHistoryEntry = {
  id: number;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown>;
  reason: string;
  changedByName: string;
  changedAt: string;
};

export type PayrollRunStatusValue = PayrollRunStatus;

export type PayrollRun = {
  id: string;
  periodMonth: string;
  status: PayrollRunStatus;
  revisionOf: string | null;
  revisionReason: string | null;
  notes: string | null;
  employeeCount: number;
  grossTotal: number;
  deductionTotal: number;
  takeHomeTotal: number;
  employerCostTotal: number;
  warnings: string[];
  calculatedAt: string | null;
  finalizedAt: string | null;
  paidAt: string | null;
  paidDate: string | null;
  createdAt: string;
};

export type PayrollRunHistoryEntry = {
  id: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  actorName: string;
  actedAt: string;
};

export type PayrollManualItem = {
  id: string;
  category: "Pendapatan" | "Potongan";
  label: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export type PayrollCalculationLine = {
  label: string;
  amount: number;
  detail?: string;
};

export type PayrollCalculation = {
  baseSalaryMonthly: number;
  fixedAllowanceMonthly: number;
  variableAllowanceMonthly: number;
  prorationFactor: number;
  proratedBaseSalary: number;
  proratedFixedAllowance: number;
  proratedVariableAllowance: number;
  workdays: number;
  fullPeriodWorkdays: number;
  alfaDays: number;
  lateCount: number;
  lateMinutes: number;
  lateToleranceMinutes: number;
  overtimeEquivalentMinutes: number;
  overtimeHours: number;
  overtimePay: number;
  manualItems: PayrollManualItem[];
  incomeLines: PayrollCalculationLine[];
  deductionLines: PayrollCalculationLine[];
  grossIncome: number;
  taxGross: number;
  bpjsKesehatanEmployee: number;
  bpjsKesehatanEmployer: number;
  jhtEmployee: number;
  jhtEmployer: number;
  jpEmployee: number;
  jpEmployer: number;
  jkkEmployer: number;
  jkmEmployer: number;
  employeeBpjsTotal: number;
  employerBpjsTotal: number;
  alfaDeduction: number;
  lateDeduction: number;
  pph21: number;
  pphMethod: "TER" | "Pasal 17";
  pphTerCategory: TerCategory | null;
  pphTerRate: number | null;
  pphPrior: number;
  pphAnnualGross: number;
  pphAnnualBiayaJabatan: number;
  pphAnnualEmployeeBpjs: number;
  pphAnnualPtkp: number;
  pphAnnualPkp: number;
  pphAnnualTax: number;
  pphPriorRunCount: number;
  totalDeductions: number;
  takeHomePay: number;
  employerCost: number;
  npwpMissing: boolean;
  warnings: string[];
  /** Tarif yang dipakai saat snapshot dibuat. */
  ratesSnapshot: PayrollSettings;
};

export type PayrollRunEmployee = {
  id: string;
  runId: string;
  employeeId: string;
  calcStatus: string;
  employeeName: string;
  department: string;
  position: string;
  employeeStatus: string;
  baseSalary: number;
  fixedAllowance: number;
  variableAllowance: number;
  workdays: number;
  alfaDays: number;
  lateCount: number;
  lateMinutes: number;
  overtimeEquivalentMinutes: number;
  prorationFactor: number;
  grossIncome: number;
  overtimePay: number;
  manualIncomeTotal: number;
  manualDeductionTotal: number;
  bpjsKesehatanEmployee: number;
  bpjsKesehatanEmployer: number;
  jhtEmployee: number;
  jhtEmployer: number;
  jpEmployee: number;
  jpEmployer: number;
  jkkEmployer: number;
  jkmEmployer: number;
  taxGross: number;
  pph21: number;
  pphMethod: string;
  terCategory: string | null;
  terRate: number | null;
  alfaDeduction: number;
  lateDeduction: number;
  totalDeductions: number;
  takeHomePay: number;
  employerCost: number;
  calculation: PayrollCalculation | null;
  items: PayrollManualItem[];
};

export type PayrollRunDetail = {
  run: PayrollRun;
  employees: PayrollRunEmployee[];
  history: PayrollRunHistoryEntry[];
};

export type PayrollRunCalculationRow = {
  employeeId: string;
  calcStatus: string;
  employeeName: string;
  department: string;
  position: string;
  employeeStatus: string;
  baseSalary: number;
  fixedAllowance: number;
  variableAllowance: number;
  workdays: number;
  alfaDays: number;
  lateCount: number;
  lateMinutes: number;
  overtimeEquivalentMinutes: number;
  prorationFactor: number;
  grossIncome: number;
  overtimePay: number;
  manualIncomeTotal: number;
  manualDeductionTotal: number;
  bpjsKesehatanEmployee: number;
  bpjsKesehatanEmployer: number;
  jhtEmployee: number;
  jhtEmployer: number;
  jpEmployee: number;
  jpEmployer: number;
  jkkEmployer: number;
  jkmEmployer: number;
  taxGross: number;
  pph21: number;
  pphMethod: string;
  terCategory: string | null;
  terRate: number | null;
  alfaDeduction: number;
  lateDeduction: number;
  totalDeductions: number;
  takeHomePay: number;
  employerCost: number;
  calculation: PayrollCalculation;
};

export type PayrollRunListItem = PayrollRun;

export type PayrollProfileInput = {
  baseSalary: number;
  fixedAllowance: number;
  variableAllowance: number;
  ptkpStatus: PtkpStatus | null;
  npwp: string;
  bpjsKesehatanNumber: string;
  bpjsKetenagakerjaanNumber: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  jkkRiskClass: JkkRiskClass;
  effectiveDate: string;
  notes: string;
};

export type PayrollProfileFieldErrors = Record<string, string>;

export type PriorPayrollYearData = {
  taxGross: number;
  pph21: number;
  jhtEmployee: number;
  jpEmployee: number;
  monthCount: number;
};

export type Payslip = {
  runId: string;
  periodMonth: string;
  status: "Final" | "Dibayar";
  paidDate: string | null;
  finalizedAt: string | null;
  employee: {
    id: string;
    name: string;
    department: string;
    position: string;
  };
  calculation: PayrollCalculation;
};

export type MyPayslipListItem = {
  runId: string;
  periodMonth: string;
  status: "Final" | "Dibayar";
  paidDate: string | null;
  takeHomePay: number;
  finalizedAt: string | null;
};
