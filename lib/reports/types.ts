export type ReportAccessType =
  | "hr"
  | "recruitment"
  | "attendance"
  | "payroll"
  | "performance"
  | "employee_export"
  | "export_history";

export const REPORT_ACCESS_TYPES: ReportAccessType[] = [
  "hr",
  "recruitment",
  "attendance",
  "payroll",
  "performance",
  "employee_export",
  "export_history",
];

export type ReportLink = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: "home" | "grid" | "users" | "pipe" | "rep" | "wallet" | "target" | "file" | "clock";
  access: "staff" | "recruitment";
};

export type HrContractRow = {
  employeeId: string;
  employeeName: string;
  department: string;
  endDate: string;
};

export type HrDocumentRow = {
  employeeId: string;
  employeeName: string;
  department: string;
  docType: string;
  title: string;
  validUntil: string;
};

export type HrReportData = {
  referenceDate: string;
  counts: {
    active: number;
    probation: number;
    inactive: number;
    newThisMonth: number;
    leftThisMonth: number;
  };
  byStatus: { status: string; total: number }[];
  byDepartment: {
    department: string;
    total: number;
    active: number;
    probation: number;
    inactive: number;
  }[];
  byEmploymentType: { employmentType: string; total: number }[];
  monthly: { monthStart: string; newCount: number; leftCount: number }[];
  contracts: { d30: HrContractRow[]; d60: HrContractRow[]; d90: HrContractRow[] };
  documents: { expiring: HrDocumentRow[]; expired: HrDocumentRow[] };
};

export type AttendanceReportRow = {
  employeeId: string;
  employeeName: string;
  department: string;
  workdays: number;
  present: number;
  lateCount: number;
  lateMinutes: number;
  alfa: number;
  cuti: number;
  izin: number;
  overtimeApprovedMinutes: number;
};

export type AttendanceDepartmentRow = {
  department: string;
  employees: number;
  workdays: number;
  present: number;
  lateCount: number;
  lateMinutes: number;
  alfa: number;
  cuti: number;
  izin: number;
  overtimeApprovedMinutes: number;
};

export type AttendanceReportData = {
  month: string;
  period: { from: string; to: string; startDay: number };
  rows: AttendanceReportRow[];
  departments: AttendanceDepartmentRow[];
};

export type PayrollTotals = {
  employeeCount: number;
  grossTotal: number;
  deductionTotal: number;
  pph21Total: number;
  takeHomeTotal: number;
  employerCostTotal: number;
};

export type PayrollDepartmentRow = {
  department: string;
  employees: number;
  grossTotal: number;
  deductionTotal: number;
  pph21Total: number;
  takeHomeTotal: number;
  employerCostTotal: number;
};

export type PayrollBpjsTotals = {
  kesehatanEmployee: number;
  kesehatanEmployer: number;
  jhtEmployee: number;
  jhtEmployer: number;
  jpEmployee: number;
  jpEmployer: number;
  jkkEmployer: number;
  jkmEmployer: number;
};

export type PayrollReportData = {
  periods: { id: string; periodMonth: string; status: string }[];
  selectedPeriod: string | null;
  totals: PayrollTotals | null;
  previous: PayrollTotals | null;
  departments: PayrollDepartmentRow[];
  bpjs: PayrollBpjsTotals | null;
};

export type PerformanceReportEmployee = {
  employeeId: string;
  employeeName: string;
  department: string;
  finalScore: number;
  finalCategory: string;
};

export type PerformanceReportAspect = {
  aspectName: string;
  aspectDescription: string;
  averageScore: number;
  scoredCount: number;
};

export type PerformanceReportDepartment = {
  department: string;
  finalCount: number;
  averageScore: number;
  sangatBaik: number;
  baik: number;
  cukup: number;
  perluPerbaikan: number;
};

export type PerformanceReportData = {
  periods: { id: string; name: string; startDate: string; endDate: string; status: string }[];
  selectedPeriod: string | null;
  selectedPeriodName: string | null;
  counts: {
    final: number;
    dikirim: number;
    tidakLengkap: number;
    dikecualikan: number;
  };
  averageScore: number | null;
  aspects: PerformanceReportAspect[];
  departments: PerformanceReportDepartment[];
  employees: PerformanceReportEmployee[];
};

export type EmployeeExportRow = {
  employeeId: string;
  fullName: string;
  department: string;
  position: string;
  managerName: string;
  status: string;
  employmentType: string;
  location: string;
  joinedAt: string;
};

export type EmployeeExportData = {
  rows: EmployeeExportRow[];
  departments: string[];
  counts: { total: number; active: number; probation: number; inactive: number };
};

export type ReportExportLogEntry = {
  id: string;
  reportType: string;
  reportLabel: string;
  filterSummary: string;
  rowCount: number;
  exportedByName: string;
  createdAt: string;
};

export type ReportExportFilters = {
  q: string;
  from: string;
  to: string;
};
