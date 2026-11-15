import {
  reportFailure,
  reportRecruitmentGuard,
} from "@/lib/reports/http";
import { reportFilename, sendReportWorkbook } from "@/lib/reports/export";
import { assertReportAccess } from "@/lib/reports/repository";
import { buildRecruitmentReportXlsx } from "@/lib/reports/xlsx";
import {
  listReportApplications,
  loadRecruitmentReport,
  normalizeJobFilter,
} from "@/lib/recruitment/live/reports";
import {
  isReportPeriod,
  periodLabel,
} from "@/lib/recruitment/reports/model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await reportRecruitmentGuard();
  if (guard.response) return guard.response;
  try {
    await assertReportAccess("recruitment");
    const url = new URL(request.url);
    const periodParam = url.searchParams.get("period");
    const period = isReportPeriod(periodParam) ? periodParam : "30";
    const jobId = normalizeJobFilter(url.searchParams.get("job"));
    const [report, applications] = await Promise.all([
      loadRecruitmentReport(period, jobId),
      listReportApplications(period, jobId),
    ]);
    const jobTitle =
      jobId === null
        ? "Semua lowongan"
        : report.jobs.find((job) => job.id === jobId)?.title ?? "Lowongan dipilih";
    const workbook = await buildRecruitmentReportXlsx(report, applications);
    return await sendReportWorkbook({
      workbook,
      filename: reportFilename("laporan-rekrutmen"),
      reportType: "recruitment",
      filterSummary: `Periode: ${periodLabel(period)}; Lowongan: ${jobTitle}`,
    });
  } catch (error) {
    return reportFailure(error, "gagal mengekspor laporan rekrutmen");
  }
}
