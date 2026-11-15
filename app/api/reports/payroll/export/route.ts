import { isoDateJakarta } from "@/lib/datetime";
import { reportFailure, reportStaffGuard } from "@/lib/reports/http";
import { reportFilename, sendReportWorkbook } from "@/lib/reports/export";
import {
  getPayrollReport,
  ReportDataError,
} from "@/lib/reports/repository";
import { buildPayrollReportXlsx } from "@/lib/reports/xlsx";
import { formatReportMonth } from "@/lib/reports/rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const guard = await reportStaffGuard();
  if (guard.response) return guard.response;
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get("period");
    const period = raw && DATE.test(raw) ? raw : null;
    const data = await getPayrollReport(period);
    if (!data.selectedPeriod || !data.totals) {
      throw new ReportDataError(
        "Belum ada payroll Final/Dibayar untuk diekspor",
        400
      );
    }
    const workbook = await buildPayrollReportXlsx(data);
    return await sendReportWorkbook({
      workbook,
      filename: reportFilename(`laporan-payroll-${data.selectedPeriod.slice(0, 7)}`),
      reportType: "payroll",
      filterSummary: `Periode: ${formatReportMonth(data.selectedPeriod.slice(0, 7))}`,
    });
  } catch (error) {
    return reportFailure(error, "gagal mengekspor laporan payroll");
  }
}
