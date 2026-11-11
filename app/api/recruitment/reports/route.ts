import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { recruitmentFailure } from "@/lib/recruitment/live/http";
import {
  loadRecruitmentReport,
  normalizeJobFilter,
} from "@/lib/recruitment/live/reports";
import { isReportPeriod } from "@/lib/recruitment/reports/model";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireApiRole(["hr_manager", "recruiter"]);
  if (guard.response) return guard.response;

  try {
    const url = new URL(request.url);
    const periodParam = url.searchParams.get("period");
    const period = isReportPeriod(periodParam) ? periodParam : "30";
    const jobId = normalizeJobFilter(url.searchParams.get("job"));

    return NextResponse.json(
      { report: await loadRecruitmentReport(period, jobId) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}
