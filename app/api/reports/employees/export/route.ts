import {
  reportFailure,
  reportStaffGuard,
  textParam,
} from "@/lib/reports/http";
import { reportFilename, sendReportWorkbook } from "@/lib/reports/export";
import { getEmployeeExportData } from "@/lib/reports/repository";
import { buildEmployeeExportXlsx } from "@/lib/reports/xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await reportStaffGuard();
  if (guard.response) return guard.response;
  try {
    const url = new URL(request.url);
    const status = textParam(url.searchParams.get("status"), "Semua");
    const department = textParam(url.searchParams.get("department"), "Semua");
    const data = await getEmployeeExportData(status, department);
    const workbook = await buildEmployeeExportXlsx(data);
    return await sendReportWorkbook({
      workbook,
      filename: reportFilename("daftar-karyawan"),
      reportType: "employee_export",
      filterSummary: `Status: ${status}; Departemen: ${department}`,
    });
  } catch (error) {
    return reportFailure(error, "gagal mengekspor daftar karyawan");
  }
}
