/** Lapisan data laporan (server-side, read-only). */

import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { getRecapData } from "@/lib/recap/repository";
import { attendanceTotals } from "@/lib/reports/rules";
import type {
  AttendanceDepartmentRow,
  AttendanceReportData,
  AttendanceReportRow,
  EmployeeExportData,
  EmployeeExportRow,
  HrReportData,
  PayrollBpjsTotals,
  PayrollDepartmentRow,
  PayrollReportData,
  PayrollTotals,
  PerformanceReportData,
  PerformanceReportDepartment,
  PerformanceReportEmployee,
  ReportAccessType,
  ReportExportLogEntry,
} from "@/lib/reports/types";

export type ReportTechnicalError = {
  code?: string;
  functionName?: string;
  message?: string;
};

export class ReportDataError extends Error {
  readonly status: number;
  readonly technical?: ReportTechnicalError;
  constructor(
    message: string,
    status = 400,
    technical?: ReportTechnicalError
  ) {
    super(message);
    this.name = "ReportDataError";
    this.status = status;
    this.technical = technical;
  }
}

const mapDbError = (
  error: { code?: string; message?: string },
  action: string
) => {
  if (error.code === "42501") {
    return new ReportDataError("Akses ditolak oleh aturan keamanan data", 403);
  }
  return new ReportDataError(
    `Gagal ${action} data laporan`,
    500,
    { code: error.code, message: error.message }
  );
};

const mapReportRpcError = (
  error: { message?: string; code?: string },
  functionName: string
) => {
  const message = error.message?.trim() || "Gagal memuat laporan";
  if (error.code === "42501") return new ReportDataError(message, 403);
  if (error.code === "P0002") return new ReportDataError(message, 404);
  if (error.code === "P0001") return new ReportDataError(message, 400);
  return new ReportDataError(
    "Gagal memuat laporan",
    500,
    { code: error.code, functionName, message }
  );
};

export async function assertReportAccess(
  reportType: ReportAccessType
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "report_assert_access",
    { p_report_type: reportType }
  );
  if (error) throw mapReportRpcError(error, "report_assert_access");
}

type HrSummaryJson = {
  reference_date: string;
  counts: {
    active: number;
    probation: number;
    inactive: number;
    new_this_month: number;
    left_this_month: number;
  };
  by_status: { status: string; total: number }[];
  by_department: {
    department: string;
    total: number;
    active: number;
    probation: number;
    inactive: number;
  }[];
  by_employment_type: { employment_type: string; total: number }[];
  monthly: { month_start: string; new_count: number; left_count: number }[];
  contracts: {
    d30: { employee_id: string; employee_name: string; department: string; end_date: string }[];
    d60: { employee_id: string; employee_name: string; department: string; end_date: string }[];
    d90: { employee_id: string; employee_name: string; department: string; end_date: string }[];
  };
  documents: {
    expiring: {
      employee_id: string;
      employee_name: string;
      department: string;
      doc_type: string;
      title: string;
      valid_until: string;
    }[];
    expired: {
      employee_id: string;
      employee_name: string;
      department: string;
      doc_type: string;
      title: string;
      valid_until: string;
    }[];
  };
};

const contractRows = (rows: HrSummaryJson["contracts"]["d30"]) =>
  rows.map((row) => ({
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    endDate: row.end_date,
  }));

const documentRows = (rows: HrSummaryJson["documents"]["expiring"]) =>
  rows.map((row) => ({
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    docType: row.doc_type,
    title: row.title,
    validUntil: row.valid_until,
  }));

export async function getHrReport(referenceDate: string): Promise<HrReportData> {
  await assertReportAccess("hr");
  const { data, error } = await (await getServerSupabase()).rpc(
    "report_hr_summary",
    { p_reference_date: referenceDate }
  );
  if (error) throw mapReportRpcError(error, "report_hr_summary");
  const summary = data as HrSummaryJson;
  return {
    referenceDate: summary.reference_date,
    counts: {
      active: summary.counts.active,
      probation: summary.counts.probation,
      inactive: summary.counts.inactive,
      newThisMonth: summary.counts.new_this_month,
      leftThisMonth: summary.counts.left_this_month,
    },
    byStatus: summary.by_status,
    byDepartment: summary.by_department,
    byEmploymentType: summary.by_employment_type.map((row) => ({
      employmentType: row.employment_type,
      total: row.total,
    })),
    monthly: summary.monthly.map((row) => ({
      monthStart: row.month_start,
      newCount: row.new_count,
      leftCount: row.left_count,
    })),
    contracts: {
      d30: contractRows(summary.contracts.d30 ?? []),
      d60: contractRows(summary.contracts.d60 ?? []),
      d90: contractRows(summary.contracts.d90 ?? []),
    },
    documents: {
      expiring: documentRows(summary.documents.expiring ?? []),
      expired: documentRows(summary.documents.expired ?? []),
    },
  };
}

export async function getAttendanceReport(
  month: string,
  department: string
): Promise<AttendanceReportData> {
  await assertReportAccess("attendance");
  const recap = await getRecapData(month);
  const allRows: AttendanceReportRow[] = recap.rows.map((row) => ({
    employeeId: row.employee.id,
    employeeName: row.employee.fullName,
    department: row.employee.department,
    workdays: row.workdays,
    present: row.present,
    lateCount: row.lateCount,
    lateMinutes: row.lateMinutes,
    alfa: row.alfa,
    cuti: row.cuti,
    izin: row.izin,
    overtimeApprovedMinutes: row.overtimeApprovedMinutes,
  }));
  const rows =
    department === "Semua"
      ? allRows
      : allRows.filter((row) => row.department === department);

  const byDepartment = new Map<string, AttendanceReportRow[]>();
  for (const row of rows) {
    const list = byDepartment.get(row.department) ?? [];
    list.push(row);
    byDepartment.set(row.department, list);
  }
  const departments: AttendanceDepartmentRow[] = [...byDepartment.entries()]
    .map(([name, items]) => ({
      department: name,
      employees: items.length,
      ...attendanceTotals(items),
    }))
    .sort((a, b) => a.department.localeCompare(b.department, "id"));

  return {
    month,
    period: {
      from: recap.period.from,
      to: recap.period.to,
      startDay: recap.period.startDay,
    },
    rows,
    departments,
  };
}

type PayrollRunRow = {
  id: string;
  period_month: string;
  status: string;
  employee_count: number;
  gross_total: number;
  deduction_total: number;
  pph21_total: number;
  take_home_total: number;
  employer_cost_total: number;
};

type PayrollEmployeeRow = {
  department: string;
  gross_income: number;
  total_deductions: number;
  pph21: number;
  take_home_pay: number;
  employer_cost: number;
  bpjs_kesehatan_employee: number;
  bpjs_kesehatan_employer: number;
  jht_employee: number;
  jht_employer: number;
  jp_employee: number;
  jp_employer: number;
  jkk_employer: number;
  jkm_employer: number;
};

const payrollTotalsFromRun = (run: PayrollRunRow): PayrollTotals => ({
  employeeCount: run.employee_count,
  grossTotal: run.gross_total,
  deductionTotal: run.deduction_total,
  pph21Total: run.pph21_total,
  takeHomeTotal: run.take_home_total,
  employerCostTotal: run.employer_cost_total,
});

export async function getPayrollReport(
  period: string | null
): Promise<PayrollReportData> {
  await assertReportAccess("payroll");
  const db = await getServerSupabase();
  const runResult = await db
    .from("payroll_runs")
    .select(
      "id, period_month, status, employee_count, gross_total, deduction_total, pph21_total, take_home_total, employer_cost_total"
    )
    .in("status", ["Final", "Dibayar"])
    .order("period_month", { ascending: false });
  if (runResult.error) throw mapDbError(runResult.error, "memuat payroll");
  const runs = (runResult.data ?? []) as PayrollRunRow[];
  const periods = runs.map((run) => ({
    id: run.id,
    periodMonth: run.period_month,
    status: run.status,
  }));
  if (runs.length === 0) {
    return {
      periods,
      selectedPeriod: null,
      totals: null,
      previous: null,
      departments: [],
      bpjs: null,
    };
  }

  const selected = runs.find((run) => run.period_month === period) ?? runs[0];
  const previous =
    runs.find((run) => run.period_month < selected.period_month) ?? null;

  const employeeResult = await db
    .from("payroll_run_employees")
    .select(
      "department, gross_income, total_deductions, pph21, take_home_pay, employer_cost, bpjs_kesehatan_employee, bpjs_kesehatan_employer, jht_employee, jht_employer, jp_employee, jp_employer, jkk_employer, jkm_employer"
    )
    .eq("run_id", selected.id);
  if (employeeResult.error) {
    throw mapDbError(employeeResult.error, "memuat rincian payroll");
  }
  const rows = (employeeResult.data ?? []) as PayrollEmployeeRow[];
  const byDepartment = new Map<string, PayrollDepartmentRow>();
  const bpjs: PayrollBpjsTotals = {
    kesehatanEmployee: 0,
    kesehatanEmployer: 0,
    jhtEmployee: 0,
    jhtEmployer: 0,
    jpEmployee: 0,
    jpEmployer: 0,
    jkkEmployer: 0,
    jkmEmployer: 0,
  };
  for (const row of rows) {
    const current = byDepartment.get(row.department) ?? {
      department: row.department,
      employees: 0,
      grossTotal: 0,
      deductionTotal: 0,
      pph21Total: 0,
      takeHomeTotal: 0,
      employerCostTotal: 0,
    };
    current.employees += 1;
    current.grossTotal += row.gross_income;
    current.deductionTotal += row.total_deductions;
    current.pph21Total += row.pph21;
    current.takeHomeTotal += row.take_home_pay;
    current.employerCostTotal += row.employer_cost;
    byDepartment.set(row.department, current);

    bpjs.kesehatanEmployee += row.bpjs_kesehatan_employee;
    bpjs.kesehatanEmployer += row.bpjs_kesehatan_employer;
    bpjs.jhtEmployee += row.jht_employee;
    bpjs.jhtEmployer += row.jht_employer;
    bpjs.jpEmployee += row.jp_employee;
    bpjs.jpEmployer += row.jp_employer;
    bpjs.jkkEmployer += row.jkk_employer;
    bpjs.jkmEmployer += row.jkm_employer;
  }

  return {
    periods,
    selectedPeriod: selected.period_month,
    totals: payrollTotalsFromRun(selected),
    previous: previous ? payrollTotalsFromRun(previous) : null,
    departments: [...byDepartment.values()].sort(
      (a, b) =>
        b.grossTotal - a.grossTotal ||
        a.department.localeCompare(b.department, "id")
    ),
    bpjs,
  };
}

type PerformancePeriodRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
};

type PerformanceReviewRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  status: string;
  final_score: number | null;
  final_category: string | null;
};

type PerformanceScoreRow = {
  review_id: string;
  aspect_name: string;
  aspect_description: string;
  sort_order: number;
  score: number | null;
};

export async function getPerformanceReportData(
  periodId: string | null
): Promise<PerformanceReportData> {
  await assertReportAccess("performance");
  const db = await getServerSupabase();
  const periodResult = await db
    .from("performance_periods")
    .select("id, name, start_date, end_date, status")
    .order("start_date", { ascending: false });
  if (periodResult.error) throw mapDbError(periodResult.error, "memuat periode");
  const periodRows = (periodResult.data ?? []) as PerformancePeriodRow[];
  const periods = periodRows.map((row) => ({
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
  }));
  if (periodRows.length === 0) {
    return {
      periods,
      selectedPeriod: null,
      selectedPeriodName: null,
      counts: { final: 0, dikirim: 0, tidakLengkap: 0, dikecualikan: 0 },
      averageScore: null,
      aspects: [],
      departments: [],
      employees: [],
    };
  }

  const selected = periodRows.find((row) => row.id === periodId) ?? periodRows[0];
  const reviewResult = await db
    .from("performance_reviews")
    .select(
      "id, employee_id, employee_name, department, status, final_score, final_category"
    )
    .eq("period_id", selected.id)
    .order("employee_name", { ascending: true });
  if (reviewResult.error) throw mapDbError(reviewResult.error, "memuat penilaian");
  const reviews = (reviewResult.data ?? []) as PerformanceReviewRow[];

  const counts = {
    final: reviews.filter((row) => row.status === "Final").length,
    dikirim: reviews.filter((row) => row.status === "Dikirim").length,
    tidakLengkap: reviews.filter((row) => row.status === "Tidak lengkap").length,
    dikecualikan: reviews.filter((row) => row.status === "Dikecualikan").length,
  };
  const finals = reviews.filter(
    (row) => row.status === "Final" && row.final_score !== null
  );

  const employees: PerformanceReportEmployee[] = finals.map((row) => ({
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department,
    finalScore: row.final_score ?? 0,
    finalCategory: row.final_category ?? "Perlu Perbaikan",
  }));

  const employeeScores =
    finals.length > 0
      ? await db
          .from("performance_review_scores")
          .select("review_id, aspect_name, aspect_description, sort_order, score")
          .in(
            "review_id",
            finals.map((row) => row.id)
          )
      : { data: [], error: null };
  if (employeeScores.error) {
    throw mapDbError(employeeScores.error, "memuat skor penilaian");
  }
  const aspectMap = new Map<
    string,
    { description: string; order: number; total: number; count: number }
  >();
  for (const row of (employeeScores.data ?? []) as PerformanceScoreRow[]) {
    if (row.score === null) continue;
    const current = aspectMap.get(row.aspect_name) ?? {
      description: row.aspect_description,
      order: row.sort_order,
      total: 0,
      count: 0,
    };
    current.total += row.score;
    current.count += 1;
    current.order = Math.min(current.order, row.sort_order);
    aspectMap.set(row.aspect_name, current);
  }
  const aspects = [...aspectMap.entries()]
    .map(([aspectName, value]) => ({
      aspectName,
      aspectDescription: value.description,
      averageScore:
        value.count > 0 ? Math.round((value.total / value.count) * 100) / 100 : 0,
      scoredCount: value.count,
    }))
    .sort((a, b) => {
      const orderA = aspectMap.get(a.aspectName)?.order ?? 0;
      const orderB = aspectMap.get(b.aspectName)?.order ?? 0;
      return orderA - orderB || a.aspectName.localeCompare(b.aspectName, "id");
    });

  const departmentMap = new Map<
    string,
    PerformanceReportDepartment & { totalScore: number }
  >();
  for (const employee of employees) {
    const current = departmentMap.get(employee.department) ?? {
      department: employee.department,
      finalCount: 0,
      averageScore: 0,
      sangatBaik: 0,
      baik: 0,
      cukup: 0,
      perluPerbaikan: 0,
      totalScore: 0,
    };
    current.finalCount += 1;
    current.totalScore += employee.finalScore;
    if (employee.finalCategory === "Sangat Baik") current.sangatBaik += 1;
    else if (employee.finalCategory === "Baik") current.baik += 1;
    else if (employee.finalCategory === "Cukup") current.cukup += 1;
    else current.perluPerbaikan += 1;
    departmentMap.set(employee.department, current);
  }
  const departments = [...departmentMap.values()]
    .map(({ totalScore, ...row }) => ({
      ...row,
      averageScore:
        row.finalCount > 0
          ? Math.round((totalScore / row.finalCount) * 100) / 100
          : 0,
    }))
    .sort(
      (a, b) =>
        b.averageScore - a.averageScore ||
        a.department.localeCompare(b.department, "id")
    );

  const averageScore =
    employees.length > 0
      ? Math.round(
          (employees.reduce((sum, row) => sum + row.finalScore, 0) /
            employees.length) *
            100
        ) / 100
      : null;

  return {
    periods,
    selectedPeriod: selected.id,
    selectedPeriodName: selected.name,
    counts,
    averageScore,
    aspects,
    departments,
    employees,
  };
}

type EmployeeExportRpcRow = {
  employee_id: string;
  full_name: string;
  department: string;
  job_position: string;
  manager_name: string | null;
  status: string;
  employment_type: string;
  location: string;
  joined_at: string;
};

export async function getEmployeeExportData(
  status: string,
  department: string
): Promise<EmployeeExportData> {
  await assertReportAccess("employee_export");
  const db = await getServerSupabase();
  const [exportResult, departmentResult] = await Promise.all([
    db.rpc("report_employee_export", {
      p_status: status,
      p_department: department,
    }),
    db.from("employee_directory").select("department").order("department"),
  ]);
  if (exportResult.error) {
    throw mapReportRpcError(exportResult.error, "report_employee_export");
  }
  if (departmentResult.error) {
    throw mapDbError(departmentResult.error, "memuat departemen");
  }

  const rows: EmployeeExportRow[] = (
    (exportResult.data ?? []) as EmployeeExportRpcRow[]
  ).map((row) => ({
    employeeId: row.employee_id,
    fullName: row.full_name,
    department: row.department,
    position: row.job_position,
    managerName: row.manager_name ?? "—",
    status: row.status,
    employmentType: row.employment_type,
    location: row.location,
    joinedAt: row.joined_at,
  }));
  return {
    rows,
    departments: [
      ...new Set(
        ((departmentResult.data ?? []) as { department: string }[]).map(
          (row) => row.department
        )
      ),
    ].sort((a, b) => a.localeCompare(b, "id")),
    counts: {
      total: rows.length,
      active: rows.filter((row) => row.status === "Aktif").length,
      probation: rows.filter((row) => row.status === "Probation").length,
      inactive: rows.filter((row) => row.status === "Nonaktif").length,
    },
  };
}

export async function logReportExport(input: {
  reportType: ReportAccessType;
  reportLabel: string;
  filterSummary: string;
  rowCount: number;
}): Promise<string> {
  const { data, error } = await (await getServerSupabase()).rpc(
    "log_report_export",
    {
      p_report_type: input.reportType,
      p_report_label: input.reportLabel,
      p_filter_summary: input.filterSummary,
      p_row_count: input.rowCount,
    }
  );
  if (error) throw mapReportRpcError(error, "log_report_export");
  return data as string;
}

export async function listReportExports(
  filters: { from: string; to: string }
): Promise<ReportExportLogEntry[]> {
  await assertReportAccess("export_history");
  const db = await getServerSupabase();
  let query = db
    .from("report_export_log")
    .select(
      "id, report_type, report_label, filter_summary, row_count, exported_by_name, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00+07:00`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59+07:00`);
  const { data, error } = await query;
  if (error) throw mapDbError(error, "memuat riwayat ekspor");
  return ((data ?? []) as {
    id: string;
    report_type: string;
    report_label: string;
    filter_summary: string;
    row_count: number;
    exported_by_name: string | null;
    created_at: string;
  }[]).map((row) => ({
    id: row.id,
    reportType: row.report_type,
    reportLabel: row.report_label,
    filterSummary: row.filter_summary,
    rowCount: row.row_count,
    exportedByName: row.exported_by_name ?? "Sistem",
    createdAt: row.created_at,
  }));
}
