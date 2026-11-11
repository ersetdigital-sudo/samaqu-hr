import { LaporanView } from "@/components/views/laporan-view";
import { requireRole } from "@/lib/auth/session";
import {
  loadRecruitmentReport,
  normalizeJobFilter,
} from "@/lib/recruitment/live/reports";
import { isReportPeriod } from "@/lib/recruitment/reports/model";

export const dynamic = "force-dynamic";

export default async function RecruitmentLaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; job?: string }>;
}) {
  await requireRole(["hr_manager", "recruiter"]);

  const params = await searchParams;
  const period = isReportPeriod(params.period) ? params.period : "30";
  const jobId = normalizeJobFilter(params.job);

  try {
    const report = await loadRecruitmentReport(period, jobId);
    return (
      <LaporanView
        initial={report}
        initialPeriod={period}
        initialJob={jobId ?? "all"}
      />
    );
  } catch {
    return (
      <LaporanView
        initial={null}
        initialPeriod={period}
        initialJob={jobId ?? "all"}
        initialError="Laporan belum dapat dimuat. Silakan coba lagi."
      />
    );
  }
}
