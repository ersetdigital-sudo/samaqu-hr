import { isoDateJakarta } from "@/lib/datetime";
import { reportFailure, reportStaffGuard } from "@/lib/reports/http";
import { reportFilename, sendReportWorkbook } from "@/lib/reports/export";
import {
  getPerformanceReportData,
  ReportDataError,
} from "@/lib/reports/repository";
import { buildPerformanceReportXlsx } from "@/lib/reports/xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const guard = await reportStaffGuard();
  if (guard.response) return guard.response;
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get("period");
    const period = raw && UUID.test(raw) ? raw : null;
    const data = await getPerformanceReportData(period);
    if (!data.selectedPeriod) {
      throw new ReportDataError(
        "Belum ada periode penilaian untuk diekspor",
        400
      );
    }
    const workbook = await buildPerformanceReportXlsx(data);
    return await sendReportWorkbook({
      workbook,
      filename: reportFilename("laporan-performance"),
      reportType: "performance",
      filterSummary: `Periode: ${data.selectedPeriodName ?? "—"}`,
    });
  } catch (error) {
    return reportFailure(error, "gagal mengekspor laporan performance");
  }
}
