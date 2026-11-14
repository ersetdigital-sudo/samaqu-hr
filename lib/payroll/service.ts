/** Orkestrasi perhitungan payroll dari Rekap, Lembur, profil, dan settings. */

import "server-only";
import { getRecapData } from "@/lib/recap/repository";
import {
  buildPayrollRunTotals,
  calculatePayrollRow,
  countWorkdaysBetween,
  shouldIncludeRecapRow,
} from "@/lib/payroll/rules";
import {
  addPayrollItem,
  createPayrollRun,
  deletePayrollItem,
  getPayrollProfiles,
  getPayrollRunDetail,
  getPayrollSettings,
  getPayrollScheduleContext,
  getPayrollTerRates,
  getPriorPayrollData,
  PayrollDataError,
  revisePayrollRun,
  savePayrollCalculation,
} from "@/lib/payroll/repository";
import type {
  PayrollManualItem,
  PayrollRunCalculationRow,
  PriorPayrollYearData,
} from "@/lib/payroll/types";

function manualTotals(items: PayrollManualItem[]) {
  return {
    income: items
      .filter((item) => item.category === "Pendapatan")
      .reduce((sum, item) => sum + item.amount, 0),
    deduction: items
      .filter((item) => item.category === "Potongan")
      .reduce((sum, item) => sum + item.amount, 0),
  };
}

export async function recalculatePayrollRun(runId: string): Promise<void> {
  const detail = await getPayrollRunDetail(runId);
  if (!detail) throw new PayrollDataError("Payroll run tidak ditemukan", 404);
  if (detail.run.status !== "Draft") {
    throw new PayrollDataError("Hanya run Draft yang dapat dihitung ulang", 400);
  }

  const [settingsData, profiles, terRates, recap, priorRuns] =
    await Promise.all([
      getPayrollSettings(),
      getPayrollProfiles(),
      getPayrollTerRates(),
      getRecapData(detail.run.periodMonth.slice(0, 7)),
      detail.run.periodMonth.slice(5, 7) === "12"
        ? getPriorPayrollData(detail.run.periodMonth)
        : Promise.resolve(new Map<string, PriorPayrollYearData>())
    ]);

  // Period presisi dari recap (mengikuti cut-off).
  const scheduleContextActual = await getPayrollScheduleContext({
    from: recap.period.from,
    to: recap.period.to,
  });
  const schedule = scheduleContextActual.schedule;
  const holidays = scheduleContextActual.holidays;
  const prior = priorRuns;
  const fullPeriodWorkdays = countWorkdaysBetween(
    recap.period.from,
    recap.period.to,
    schedule,
    holidays
  );

  const profileByEmployee = new Map(
    profiles.map((record) => [record.employee.id, record.profile])
  );
  const itemsByEmployee = new Map(
    detail.employees.map((employee) => [employee.employeeId, employee.items])
  );

  const rows: PayrollRunCalculationRow[] = [];
  const calculationResults: {
    employeeName: string;
    calculation: ReturnType<typeof calculatePayrollRow>["calculation"];
    status: string;
  }[] = [];

  for (const recapRow of recap.rows) {
    if (!shouldIncludeRecapRow(recapRow)) continue;
    const profile = profileByEmployee.get(recapRow.employee.id) ?? null;
    const manualItems = itemsByEmployee.get(recapRow.employee.id) ?? [];
    const result = calculatePayrollRow({
      employee: recapRow.employee,
      profile,
      recap: recapRow,
      settings: settingsData.settings,
      terRates,
      period: recap.period,
      fullPeriodWorkdays,
      lateToleranceMinutes: schedule?.lateToleranceMinutes ?? 0,
      manualItems,
      prior: prior.get(recapRow.employee.id) ?? null,
    });
    const manual = manualTotals(manualItems);
    rows.push({
      employeeId: recapRow.employee.id,
      calcStatus: result.status,
      employeeName: recapRow.employee.fullName,
      department: recapRow.employee.department,
      position: recapRow.employee.position,
      employeeStatus: recapRow.employee.status,
      baseSalary: result.calculation.baseSalaryMonthly,
      fixedAllowance: result.calculation.fixedAllowanceMonthly,
      variableAllowance: result.calculation.variableAllowanceMonthly,
      workdays: result.calculation.workdays,
      alfaDays: result.calculation.alfaDays,
      lateCount: result.calculation.lateCount,
      lateMinutes: result.calculation.lateMinutes,
      overtimeEquivalentMinutes: result.calculation.overtimeEquivalentMinutes,
      prorationFactor: result.calculation.prorationFactor,
      grossIncome: result.calculation.grossIncome,
      overtimePay: result.calculation.overtimePay,
      manualIncomeTotal: manual.income,
      manualDeductionTotal: manual.deduction,
      bpjsKesehatanEmployee: result.calculation.bpjsKesehatanEmployee,
      bpjsKesehatanEmployer: result.calculation.bpjsKesehatanEmployer,
      jhtEmployee: result.calculation.jhtEmployee,
      jhtEmployer: result.calculation.jhtEmployer,
      jpEmployee: result.calculation.jpEmployee,
      jpEmployer: result.calculation.jpEmployer,
      jkkEmployer: result.calculation.jkkEmployer,
      jkmEmployer: result.calculation.jkmEmployer,
      taxGross: result.calculation.taxGross,
      pph21: result.calculation.pph21,
      pphMethod: result.calculation.pphMethod,
      terCategory: result.calculation.pphTerCategory,
      terRate: result.calculation.pphTerRate,
      alfaDeduction: result.calculation.alfaDeduction,
      lateDeduction: result.calculation.lateDeduction,
      totalDeductions: result.calculation.totalDeductions,
      takeHomePay: result.calculation.takeHomePay,
      employerCost: result.calculation.employerCost,
      calculation: result.calculation,
    });
    calculationResults.push({
      employeeName: recapRow.employee.fullName,
      calculation: result.calculation,
      status: result.status,
    });
  }

  const totals = buildPayrollRunTotals(calculationResults);
  await savePayrollCalculation(runId, rows, totals);
}

export async function createAndCalculatePayrollRun(
  periodMonth: string
): Promise<string> {
  const run = await createPayrollRun(periodMonth);
  await recalculatePayrollRun(run.id);
  return run.id;
}

export async function reviseAndCalculatePayrollRun(
  runId: string,
  reason: string
): Promise<string> {
  const revised = await revisePayrollRun(runId, reason);
  await recalculatePayrollRun(revised.id);
  return revised.id;
}

export async function addPayrollItemAndRecalculate(
  runId: string,
  employeeId: string,
  category: "Pendapatan" | "Potongan",
  label: string,
  amount: number,
  reason: string
): Promise<void> {
  await addPayrollItem(runId, employeeId, category, label, amount, reason);
  await recalculatePayrollRun(runId);
}

export async function deletePayrollItemAndRecalculate(
  runId: string,
  itemId: string
): Promise<void> {
  await deletePayrollItem(itemId);
  await recalculatePayrollRun(runId);
}
