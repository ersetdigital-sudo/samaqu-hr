import { isoDateJakarta } from "@/lib/datetime";
import {
  dateParam,
  reportFailure,
  reportStaffGuard,
} from "@/lib/reports/http";
import { reportFilename, sendReportWorkbook } from "@/lib/reports/export";
import { getHrReport } from "@/lib/reports/repository";
import { buildHrReportXlsx } from "@/lib/reports/xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await reportStaffGuard();
  if (guard.response) return guard.response;
  try {
    const url = new URL(request.url);
    const date = dateParam(url.searchParams.get("date"), isoDateJakarta());
    const data = await getHrReport(date);
    const workbook = await buildHrReportXlsx(data);
    return await sendReportWorkbook({
      workbook,
      filename: reportFilename("laporan-hr"),
      reportType: "hr",
      filterSummary: `Tanggal acuan: ${date}`,
    });
  } catch (error) {
    return reportFailure(error, "gagal mengekspor laporan HR");
  }
}
