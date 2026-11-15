import { isoDateJakarta } from "@/lib/datetime";
import {
  monthParam,
  reportFailure,
  reportStaffGuard,
  textParam,
} from "@/lib/reports/http";
import { reportFilename, sendReportWorkbook } from "@/lib/reports/export";
import { getAttendanceReport } from "@/lib/reports/repository";
import { buildAttendanceReportXlsx } from "@/lib/reports/xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await reportStaffGuard();
  if (guard.response) return guard.response;
  try {
    const url = new URL(request.url);
    const month = monthParam(
      url.searchParams.get("month"),
      isoDateJakarta().slice(0, 7)
    );
    const department = textParam(url.searchParams.get("department"), "Semua");
    const data = await getAttendanceReport(month, department);
    const workbook = await buildAttendanceReportXlsx(data);
    return await sendReportWorkbook({
      workbook,
      filename: reportFilename("laporan-kehadiran"),
      reportType: "attendance",
      filterSummary: `Periode: ${month}; Departemen: ${department}`,
    });
  } catch (error) {
    return reportFailure(error, "gagal mengekspor laporan kehadiran");
  }
}
