/** Lapisan akses data Payroll (server-side). */

import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  payrollProfileIssues,
} from "@/lib/payroll/rules";
import type {
  JkkRiskClass,
  MyPayslipListItem,
  PayrollCalculation,
  PayrollEmployeeRef,
  PayrollManualItem,
  PayrollProfile,
  PayrollProfileHistoryEntry,
  PayrollProfileInput,
  PayrollProfileRecord,
  PayrollRun,
  PayrollRunCalculationRow,
  PayrollRunDetail,
  PayrollRunEmployee,
  PayrollRunHistoryEntry,
  PayrollRunStatus,
  PayrollSettings,
  PayrollSettingsData,
  PayrollSettingsHistoryEntry,
  Payslip,
  PriorPayrollYearData,
  PtkpStatus,
  TerRate,
} from "@/lib/payroll/types";
import type { HolidayEntry, WorkSchedule } from "@/lib/attendance/types";

export class PayrollDataError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string>;
  constructor(
    message: string,
    status = 400,
    errors?: Record<string, string>
  ) {
    super(message);
    this.name = "PayrollDataError";
    this.status = status;
    this.errors = errors;
  }
}

type SettingsRow = {
  settings: PayrollSettings;
  effective_date: string;
  updated_by: string | null;
  updated_at: string;
};

type SettingsHistoryRow = {
  id: number;
  old_settings: Record<string, unknown> | null;
  new_settings: Record<string, unknown>;
  effective_date: string;
  reason: string;
  changed_by: string | null;
  changed_at: string;
};

type ProfileRow = {
  employee_id: string;
  base_salary: number;
  fixed_allowance: number;
  variable_allowance: number;
  ptkp_status: PtkpStatus | null;
  npwp: string | null;
  bpjs_kesehatan_number: string | null;
  bpjs_ketenagakerjaan_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  jkk_risk_class: JkkRiskClass;
  effective_date: string;
  notes: string | null;
  updated_at: string;
};

type ProfileHistoryRow = {
  id: number;
  employee_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown>;
  reason: string;
  changed_by: string | null;
  changed_at: string;
};

type EmployeeRow = {
  id: string;
  full_name: string;
  department: string;
  position: string;
  status: string;
  joined_at: string;
};

type TerRow = {
  category: "A" | "B" | "C";
  layer_no: number;
  up_to: number | null;
  rate_percent: number;
};

type RunRow = {
  id: string;
  period_month: string;
  status: PayrollRunStatus;
  revision_of: string | null;
  revision_reason: string | null;
  notes: string | null;
  employee_count: number;
  gross_total: number;
  deduction_total: number;
  take_home_total: number;
  employer_cost_total: number;
  warnings: string[] | null;
  calculated_at: string | null;
  finalized_at: string | null;
  paid_at: string | null;
  paid_date: string | null;
  created_at: string;
};

type RunEmployeeRow = {
  id: string;
  run_id: string;
  employee_id: string;
  calc_status: string;
  employee_name: string;
  department: string;
  position: string;
  employee_status: string;
  base_salary: number;
  fixed_allowance: number;
  variable_allowance: number;
  workdays: number;
  alfa_days: number;
  late_count: number;
  late_minutes: number;
  overtime_equivalent_minutes: number;
  proration_factor: number;
  gross_income: number;
  overtime_pay: number;
  manual_income_total: number;
  manual_deduction_total: number;
  bpjs_kesehatan_employee: number;
  bpjs_kesehatan_employer: number;
  jht_employee: number;
  jht_employer: number;
  jp_employee: number;
  jp_employer: number;
  jkk_employer: number;
  jkm_employer: number;
  tax_gross: number;
  pph21: number;
  pph_method: string;
  ter_category: string | null;
  ter_rate: number | null;
  alfa_deduction: number;
  late_deduction: number;
  total_deductions: number;
  take_home_pay: number;
  employer_cost: number;
  calculation: PayrollCalculation | null;
};

type RunItemRow = {
  id: string;
  run_employee_id: string;
  category: "Pendapatan" | "Potongan";
  label: string;
  amount: number;
  reason: string;
  created_at: string;
};

type RunHistoryRow = {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  actor_id: string | null;
  acted_at: string;
};

const mapDbError = (error: { code?: string }, action: string) => {
  if (error.code === "42501") {
    return new PayrollDataError("Akses ditolak oleh aturan keamanan data", 403);
  }
  return new PayrollDataError(`Gagal ${action} data payroll`, 500);
};

export const mapPayrollRpcError = (error: {
  message?: string;
  code?: string;
}) => {
  const message =
    error.message?.replace(/^.*?:\s*/, "") || "Gagal memproses payroll";
  if (error.code === "42501") return new PayrollDataError(message, 403);
  if (error.code === "P0002") return new PayrollDataError(message, 404);
  if (
    error.code === "P0001" ||
    error.code === "23514" ||
    error.code === "23502" ||
    error.code === "22P02" ||
    error.code === "22007" ||
    error.code === "22008" ||
    error.code === "23505"
  ) {
    return new PayrollDataError(message, 400);
  }
  return new PayrollDataError("Gagal memproses payroll", 500);
};

const actorNames = async (
  ids: (string | null)[]
): Promise<{ nameById: Map<string, string>; resolved: boolean }> => {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const nameById = new Map<string, string>();
  if (unique.length === 0) return { nameById, resolved: true };
  const { data, error } = await (await getServerSupabase()).rpc(
    "user_full_names",
    { p_ids: unique }
  );
  if (error) return { nameById, resolved: false };
  for (const actor of (data ?? []) as { id: string; full_name: string }[]) {
    nameById.set(actor.id, actor.full_name);
  }
  return { nameById, resolved: true };
};

const profileFromRow = (row: ProfileRow): PayrollProfile => ({
  employeeId: row.employee_id,
  baseSalary: row.base_salary,
  fixedAllowance: row.fixed_allowance,
  variableAllowance: row.variable_allowance,
  ptkpStatus: row.ptkp_status,
  npwp: row.npwp,
  bpjsKesehatanNumber: row.bpjs_kesehatan_number,
  bpjsKetenagakerjaanNumber: row.bpjs_ketenagakerjaan_number,
  bankName: row.bank_name,
  bankAccountNumber: row.bank_account_number,
  bankAccountHolder: row.bank_account_holder,
  jkkRiskClass: row.jkk_risk_class,
  effectiveDate: row.effective_date,
  notes: row.notes,
  updatedAt: row.updated_at,
});

const runFromRow = (row: RunRow): PayrollRun => ({
  id: row.id,
  periodMonth: row.period_month,
  status: row.status,
  revisionOf: row.revision_of,
  revisionReason: row.revision_reason,
  notes: row.notes,
  employeeCount: row.employee_count,
  grossTotal: row.gross_total,
  deductionTotal: row.deduction_total,
  takeHomeTotal: row.take_home_total,
  employerCostTotal: row.employer_cost_total,
  warnings: row.warnings ?? [],
  calculatedAt: row.calculated_at,
  finalizedAt: row.finalized_at,
  paidAt: row.paid_at,
  paidDate: row.paid_date,
  createdAt: row.created_at,
});

export async function getPayrollSettings(): Promise<PayrollSettingsData> {
  const db = await getServerSupabase();
  const [settingsResult, historyResult] = await Promise.all([
    db
      .from("payroll_settings")
      .select("settings, effective_date, updated_by, updated_at")
      .eq("id", true)
      .maybeSingle(),
    db
      .from("payroll_settings_history")
      .select(
        "id, old_settings, new_settings, effective_date, reason, changed_by, changed_at"
      )
      .order("changed_at", { ascending: false })
      .limit(30),
  ]);

  if (settingsResult.error) {
    throw mapDbError(settingsResult.error, "memuat pengaturan");
  }
  if (!settingsResult.data) {
    throw new PayrollDataError("Pengaturan payroll belum tersedia", 500);
  }
  if (historyResult.error) {
    throw mapDbError(historyResult.error, "memuat riwayat pengaturan");
  }

  const row = settingsResult.data as SettingsRow;
  const historyRows = (historyResult.data ?? []) as SettingsHistoryRow[];
  const names = await actorNames([
    row.updated_by,
    ...historyRows.map((item) => item.changed_by),
  ]);

  return {
    settings: row.settings,
    effectiveDate: row.effective_date,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by
      ? names.nameById.get(row.updated_by) ??
        (names.resolved ? "Pengguna terhapus" : "HR")
      : null,
    history: historyRows.map(
      (item): PayrollSettingsHistoryEntry => ({
        id: item.id,
        oldSettings: item.old_settings,
        newSettings: item.new_settings,
        effectiveDate: item.effective_date,
        reason: item.reason,
        changedByName: item.changed_by
          ? names.nameById.get(item.changed_by) ??
            (names.resolved ? "Pengguna terhapus" : "HR")
          : "Sistem",
        changedAt: item.changed_at,
      })
    ),
  };
}

export async function savePayrollSettings(
  settings: PayrollSettings,
  effectiveDate: string,
  reason: string
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "save_payroll_settings",
    {
      p_settings: settings,
      p_effective_date: effectiveDate,
      p_reason: reason,
    }
  );
  if (error) throw mapPayrollRpcError(error);
}

export async function getPayrollTerRates(): Promise<TerRate[]> {
  const { data, error } = await (await getServerSupabase())
    .from("payroll_ter_rates")
    .select("category, layer_no, up_to, rate_percent")
    .order("category", { ascending: true })
    .order("layer_no", { ascending: true });
  if (error) throw mapDbError(error, "memuat tarif TER");
  return ((data ?? []) as TerRow[]).map((row) => ({
    category: row.category,
    layerNo: row.layer_no,
    upTo: row.up_to,
    ratePercent: row.rate_percent,
  }));
}

export async function getPayrollProfiles(): Promise<PayrollProfileRecord[]> {
  const db = await getServerSupabase();
  const [employeeResult, profileResult, historyResult] = await Promise.all([
    db
      .from("employees")
      .select("id, full_name, department, position, status, joined_at")
      .order("full_name", { ascending: true }),
    db.from("payroll_profiles").select("*"),
    db
      .from("payroll_profile_history")
      .select(
        "id, employee_id, old_data, new_data, reason, changed_by, changed_at"
      )
      .order("changed_at", { ascending: false })
      .limit(500),
  ]);

  if (employeeResult.error) throw mapDbError(employeeResult.error, "memuat karyawan");
  if (profileResult.error) throw mapDbError(profileResult.error, "memuat profil");
  if (historyResult.error) throw mapDbError(historyResult.error, "memuat riwayat profil");

  const profiles = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((row) => [
      row.employee_id,
      profileFromRow(row),
    ])
  );
  const historyRows = (historyResult.data ?? []) as ProfileHistoryRow[];
  const names = await actorNames(historyRows.map((row) => row.changed_by));
  const historyByEmployee = new Map<string, PayrollProfileHistoryEntry[]>();
  for (const row of historyRows) {
    const list = historyByEmployee.get(row.employee_id) ?? [];
    list.push({
      id: row.id,
      oldData: row.old_data,
      newData: row.new_data,
      reason: row.reason,
      changedByName: row.changed_by
        ? names.nameById.get(row.changed_by) ??
          (names.resolved ? "Pengguna terhapus" : "HR")
        : "Sistem",
      changedAt: row.changed_at,
    });
    historyByEmployee.set(row.employee_id, list);
  }

  return ((employeeResult.data ?? []) as EmployeeRow[]).map((employee) => {
    const profile = profiles.get(employee.id) ?? null;
    const ref: PayrollEmployeeRef = {
      id: employee.id,
      fullName: employee.full_name,
      department: employee.department,
      position: employee.position,
      status: employee.status,
      joinedAt: employee.joined_at,
    };
    return {
      employee: ref,
      profile,
      issues: payrollProfileIssues(profile),
      history: historyByEmployee.get(employee.id) ?? [],
    };
  });
}

export async function savePayrollProfile(
  employeeId: string,
  input: PayrollProfileInput,
  reason: string
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "save_payroll_profile",
    {
      p_employee_id: employeeId,
      p_profile: input,
      p_reason: reason,
    }
  );
  if (error) throw mapPayrollRpcError(error);
}

export async function listPayrollRuns(): Promise<PayrollRun[]> {
  const { data, error } = await (await getServerSupabase())
    .from("payroll_runs")
    .select(
      "id, period_month, status, revision_of, revision_reason, notes, employee_count, gross_total, deduction_total, take_home_total, employer_cost_total, warnings, calculated_at, finalized_at, paid_at, paid_date, created_at"
    )
    .order("period_month", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw mapDbError(error, "memuat run");
  return ((data ?? []) as RunRow[]).map(runFromRow);
}

export async function getPayrollRunDetail(
  runId: string
): Promise<PayrollRunDetail | null> {
  const db = await getServerSupabase();
  const [runResult, employeeResult, historyResult] = await Promise.all([
    db
      .from("payroll_runs")
      .select(
        "id, period_month, status, revision_of, revision_reason, notes, employee_count, gross_total, deduction_total, take_home_total, employer_cost_total, warnings, calculated_at, finalized_at, paid_at, paid_date, created_at"
      )
      .eq("id", runId)
      .maybeSingle(),
    db
      .from("payroll_run_employees")
      .select(
        "id, run_id, employee_id, calc_status, employee_name, department, position, employee_status, base_salary, fixed_allowance, variable_allowance, workdays, alfa_days, late_count, late_minutes, overtime_equivalent_minutes, proration_factor, gross_income, overtime_pay, manual_income_total, manual_deduction_total, bpjs_kesehatan_employee, bpjs_kesehatan_employer, jht_employee, jht_employer, jp_employee, jp_employer, jkk_employer, jkm_employer, tax_gross, pph21, pph_method, ter_category, ter_rate, alfa_deduction, late_deduction, total_deductions, take_home_pay, employer_cost, calculation"
      )
      .eq("run_id", runId)
      .order("employee_name", { ascending: true }),
    db
      .from("payroll_run_history")
      .select("id, action, from_status, to_status, reason, actor_id, acted_at")
      .eq("run_id", runId)
      .order("acted_at", { ascending: true }),
  ]);

  if (runResult.error) throw mapDbError(runResult.error, "memuat run");
  if (!runResult.data) return null;
  if (employeeResult.error) throw mapDbError(employeeResult.error, "memuat karyawan run");
  if (historyResult.error) throw mapDbError(historyResult.error, "memuat riwayat run");

  const employeeRows = (employeeResult.data ?? []) as RunEmployeeRow[];
  const employeeIds = employeeRows.map((row) => row.id);
  let items: RunItemRow[] = [];
  if (employeeIds.length > 0) {
    const itemResult = await db
      .from("payroll_run_items")
      .select("id, run_employee_id, category, label, amount, reason, created_at")
      .in("run_employee_id", employeeIds)
      .order("created_at", { ascending: true });
    if (itemResult.error) throw mapDbError(itemResult.error, "memuat item manual");
    items = (itemResult.data ?? []) as RunItemRow[];
  }

  const itemMap = new Map<string, PayrollManualItem[]>();
  for (const item of items) {
    const list = itemMap.get(item.run_employee_id) ?? [];
    list.push({
      id: item.id,
      category: item.category,
      label: item.label,
      amount: item.amount,
      reason: item.reason,
      createdAt: item.created_at,
    });
    itemMap.set(item.run_employee_id, list);
  }

  const historyRows = (historyResult.data ?? []) as RunHistoryRow[];
  const names = await actorNames(historyRows.map((row) => row.actor_id));

  const employees = employeeRows.map(
    (row): PayrollRunEmployee => ({
      id: row.id,
      runId: row.run_id,
      employeeId: row.employee_id,
      calcStatus: row.calc_status,
      employeeName: row.employee_name,
      department: row.department,
      position: row.position,
      employeeStatus: row.employee_status,
      baseSalary: row.base_salary,
      fixedAllowance: row.fixed_allowance,
      variableAllowance: row.variable_allowance,
      workdays: row.workdays,
      alfaDays: row.alfa_days,
      lateCount: row.late_count,
      lateMinutes: row.late_minutes,
      overtimeEquivalentMinutes: row.overtime_equivalent_minutes,
      prorationFactor: row.proration_factor,
      grossIncome: row.gross_income,
      overtimePay: row.overtime_pay,
      manualIncomeTotal: row.manual_income_total,
      manualDeductionTotal: row.manual_deduction_total,
      bpjsKesehatanEmployee: row.bpjs_kesehatan_employee,
      bpjsKesehatanEmployer: row.bpjs_kesehatan_employer,
      jhtEmployee: row.jht_employee,
      jhtEmployer: row.jht_employer,
      jpEmployee: row.jp_employee,
      jpEmployer: row.jp_employer,
      jkkEmployer: row.jkk_employer,
      jkmEmployer: row.jkm_employer,
      taxGross: row.tax_gross,
      pph21: row.pph21,
      pphMethod: row.pph_method,
      terCategory: row.ter_category,
      terRate: row.ter_rate,
      alfaDeduction: row.alfa_deduction,
      lateDeduction: row.late_deduction,
      totalDeductions: row.total_deductions,
      takeHomePay: row.take_home_pay,
      employerCost: row.employer_cost,
      calculation: row.calculation,
      items: itemMap.get(row.id) ?? [],
    })
  );

  return {
    run: runFromRow(runResult.data as RunRow),
    employees,
    history: historyRows.map(
      (row): PayrollRunHistoryEntry => ({
        id: row.id,
        action: row.action,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        reason: row.reason,
        actorName: row.actor_id
          ? names.nameById.get(row.actor_id) ??
            (names.resolved ? "Pengguna terhapus" : "HR")
          : "Sistem",
        actedAt: row.acted_at,
      })
    ),
  };
}

export async function createPayrollRun(periodMonth: string): Promise<PayrollRun> {
  const { data, error } = await (await getServerSupabase()).rpc(
    "create_payroll_run",
    { p_period_month: periodMonth }
  );
  if (error) throw mapPayrollRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new PayrollDataError("Run gagal dibuat", 500);
  return runFromRow(row as RunRow);
}

export async function savePayrollCalculation(
  runId: string,
  rows: PayrollRunCalculationRow[],
  totals: {
    employeeCount: number;
    grossTotal: number;
    deductionTotal: number;
    takeHomeTotal: number;
    employerCostTotal: number;
    warnings: string[];
  }
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "save_payroll_run_calculation",
    {
      p_run_id: runId,
      p_rows: rows.map((row) => ({
        employee_id: row.employeeId,
        calc_status: row.calcStatus,
        employee_name: row.employeeName,
        department: row.department,
        position: row.position,
        employee_status: row.employeeStatus,
        base_salary: row.baseSalary,
        fixed_allowance: row.fixedAllowance,
        variable_allowance: row.variableAllowance,
        workdays: row.workdays,
        alfa_days: row.alfaDays,
        late_count: row.lateCount,
        late_minutes: row.lateMinutes,
        overtime_equivalent_minutes: row.overtimeEquivalentMinutes,
        proration_factor: row.prorationFactor,
        gross_income: row.grossIncome,
        overtime_pay: row.overtimePay,
        manual_income_total: row.manualIncomeTotal,
        manual_deduction_total: row.manualDeductionTotal,
        bpjs_kesehatan_employee: row.bpjsKesehatanEmployee,
        bpjs_kesehatan_employer: row.bpjsKesehatanEmployer,
        jht_employee: row.jhtEmployee,
        jht_employer: row.jhtEmployer,
        jp_employee: row.jpEmployee,
        jp_employer: row.jpEmployer,
        jkk_employer: row.jkkEmployer,
        jkm_employer: row.jkmEmployer,
        tax_gross: row.taxGross,
        pph21: row.pph21,
        pph_method: row.pphMethod,
        ter_category: row.terCategory,
        ter_rate: row.terRate,
        alfa_deduction: row.alfaDeduction,
        late_deduction: row.lateDeduction,
        total_deductions: row.totalDeductions,
        take_home_pay: row.takeHomePay,
        employer_cost: row.employerCost,
        calculation: row.calculation,
      })),
      p_totals: {
        employeeCount: totals.employeeCount,
        grossTotal: totals.grossTotal,
        deductionTotal: totals.deductionTotal,
        takeHomeTotal: totals.takeHomeTotal,
        employerCostTotal: totals.employerCostTotal,
        warnings: totals.warnings,
      },
    }
  );
  if (error) throw mapPayrollRpcError(error);
}

export async function addPayrollItem(
  runId: string,
  employeeId: string,
  category: "Pendapatan" | "Potongan",
  label: string,
  amount: number,
  reason: string
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "add_payroll_run_item",
    {
      p_run_id: runId,
      p_employee_id: employeeId,
      p_category: category,
      p_label: label,
      p_amount: amount,
      p_reason: reason,
    }
  );
  if (error) throw mapPayrollRpcError(error);
}

export async function deletePayrollItem(itemId: string): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "delete_payroll_run_item",
    { p_item_id: itemId }
  );
  if (error) throw mapPayrollRpcError(error);
}

export async function finalizePayrollRun(runId: string): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "finalize_payroll_run",
    { p_run_id: runId }
  );
  if (error) throw mapPayrollRpcError(error);
}

export async function markPayrollRunPaid(
  runId: string,
  paidDate: string | null
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "mark_payroll_run_paid",
    { p_run_id: runId, p_paid_date: paidDate }
  );
  if (error) throw mapPayrollRpcError(error);
}

export async function revisePayrollRun(
  runId: string,
  reason: string
): Promise<PayrollRun> {
  const { data, error } = await (await getServerSupabase()).rpc(
    "revise_payroll_run",
    { p_run_id: runId, p_reason: reason }
  );
  if (error) throw mapPayrollRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new PayrollDataError("Revisi gagal dibuat", 500);
  return runFromRow(row as RunRow);
}

export async function getPayrollScheduleContext(period: {
  from: string;
  to: string;
}): Promise<{ schedule: WorkSchedule | null; holidays: HolidayEntry[] }> {
  const db = await getServerSupabase();
  const [scheduleResult, holidayResult] = await Promise.all([
    db
      .from("work_schedules")
      .select(
        "id, employee_id, name, work_days, start_time, end_time, break_minutes, late_tolerance_minutes, is_active"
      )
      .eq("is_active", true)
      .is("employee_id", null)
      .maybeSingle(),
    db
      .from("holidays")
      .select("id, holiday_date, name")
      .gte("holiday_date", period.from)
      .lte("holiday_date", period.to)
      .order("holiday_date", { ascending: true }),
  ]);

  if (scheduleResult.error) throw mapDbError(scheduleResult.error, "memuat jadwal");
  if (holidayResult.error) throw mapDbError(holidayResult.error, "memuat kalender libur");

  const schedule = scheduleResult.data
    ? ({
        id: scheduleResult.data.id,
        employeeId: scheduleResult.data.employee_id,
        name: scheduleResult.data.name,
        workDays: (scheduleResult.data.work_days ?? [])
          .map(Number)
          .sort((a: number, b: number) => a - b),
        startTime: String(scheduleResult.data.start_time).slice(0, 5),
        endTime: String(scheduleResult.data.end_time).slice(0, 5),
        breakMinutes: scheduleResult.data.break_minutes,
        lateToleranceMinutes: scheduleResult.data.late_tolerance_minutes,
        isActive: scheduleResult.data.is_active,
      } satisfies WorkSchedule)
    : null;

  return {
    schedule,
    holidays: (holidayResult.data ?? []).map((row) => ({
      id: row.id,
      holidayDate: row.holiday_date,
      name: row.name,
    })),
  };
}

export async function getPriorPayrollData(
  periodMonth: string
): Promise<Map<string, PriorPayrollYearData>> {
  const year = Number(periodMonth.slice(0, 4));
  const from = `${year}-01-01`;
  const db = await getServerSupabase();
  const runResult = await db
    .from("payroll_runs")
    .select("id, period_month")
    .gte("period_month", from)
    .lt("period_month", periodMonth)
    .in("status", ["Final", "Dibayar"]);

  if (runResult.error) throw mapDbError(runResult.error, "memuat run sebelumnya");
  const runs = (runResult.data ?? []) as { id: string; period_month: string }[];
  const map = new Map<string, PriorPayrollYearData>();
  if (runs.length === 0) return map;

  const employeeResult = await db
    .from("payroll_run_employees")
    .select("employee_id, run_id, tax_gross, pph21, jht_employee, jp_employee")
    .in("run_id", runs.map((run) => run.id));

  if (employeeResult.error) {
    throw mapDbError(employeeResult.error, "memuat penghasilan sebelumnya");
  }

  for (const row of (employeeResult.data ?? []) as {
    employee_id: string;
    run_id: string;
    tax_gross: number;
    pph21: number;
    jht_employee: number;
    jp_employee: number;
  }[]) {
    const current = map.get(row.employee_id) ?? {
      taxGross: 0,
      pph21: 0,
      jhtEmployee: 0,
      jpEmployee: 0,
      monthCount: 0,
    };
    current.taxGross += row.tax_gross;
    current.pph21 += row.pph21;
    current.jhtEmployee += row.jht_employee;
    current.jpEmployee += row.jp_employee;
    current.monthCount += 1;
    map.set(row.employee_id, current);
  }
  return map;
}

export async function listMyPayslips(): Promise<MyPayslipListItem[]> {
  const { data, error } = await (await getServerSupabase()).rpc(
    "list_my_payslips"
  );
  if (error) throw mapPayrollRpcError(error);
  return ((data ?? []) as {
    run_id: string;
    period_month: string;
    status: "Final" | "Dibayar";
    paid_date: string | null;
    take_home_pay: number;
    finalized_at: string | null;
  }[]).map((row) => ({
    runId: row.run_id,
    periodMonth: row.period_month,
    status: row.status,
    paidDate: row.paid_date,
    takeHomePay: row.take_home_pay,
    finalizedAt: row.finalized_at,
  }));
}

export async function getPayrollTransferRows(runId: string): Promise<
  {
    bankName: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
    employeeName: string;
    employeeId: string;
    takeHomePay: number;
  }[]
> {
  const db = await getServerSupabase();
  const [employeeResult, profileResult] = await Promise.all([
    db
      .from("payroll_run_employees")
      .select("employee_id, employee_name, take_home_pay")
      .eq("run_id", runId)
      .order("employee_name", { ascending: true }),
    db
      .from("payroll_profiles")
      .select(
        "employee_id, bank_name, bank_account_number, bank_account_holder"
      ),
  ]);

  if (employeeResult.error) throw mapDbError(employeeResult.error, "memuat karyawan");
  if (profileResult.error) throw mapDbError(profileResult.error, "memuat rekening");

  const profiles = new Map(
    ((profileResult.data ?? []) as {
      employee_id: string;
      bank_name: string | null;
      bank_account_number: string | null;
      bank_account_holder: string | null;
    }[]).map((row) => [row.employee_id, row])
  );

  return ((employeeResult.data ?? []) as {
    employee_id: string;
    employee_name: string;
    take_home_pay: number;
  }[])
    .map((row) => {
      const profile = profiles.get(row.employee_id);
      return {
        bankName: profile?.bank_name ?? "—",
        bankAccountNumber: profile?.bank_account_number ?? "—",
        bankAccountHolder: profile?.bank_account_holder ?? row.employee_name,
        employeeName: row.employee_name,
        employeeId: row.employee_id,
        takeHomePay: row.take_home_pay,
      };
    })
    .sort(
      (a, b) =>
        a.bankName.localeCompare(b.bankName, "id") ||
        a.employeeName.localeCompare(b.employeeName, "id")
    );
}

export async function getMyPayslip(runId: string): Promise<Payslip | null> {
  const { data, error } = await (await getServerSupabase()).rpc(
    "get_my_payslip",
    { p_run_id: runId }
  );
  if (error) {
    if (error.code === "P0002") return null;
    throw mapPayrollRpcError(error);
  }
  if (!data) return null;
  return data as Payslip;
}
