import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { startOfJakartaDay } from "@/lib/datetime";
import {
  PERIOD_OPTIONS,
  type ReportData,
  type ReportPeriod,
} from "@/lib/recruitment/reports/model";
import { RecruitmentError } from "./http";

const DAY_MS = 86_400_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReportRange = {
  start: Date | null;
  previousStart: Date | null;
  end: Date;
};

/** Rentang periode WIB; pembanding memakai panjang waktu yang sama. */
export function getReportRange(
  period: ReportPeriod,
  now = new Date()
): ReportRange {
  const option =
    PERIOD_OPTIONS.find((item) => item.value === period) ?? PERIOD_OPTIONS[0];
  if (option.days === null)
    return { start: null, previousStart: null, end: now };

  const start = startOfJakartaDay(
    new Date(now.getTime() - (option.days - 1) * DAY_MS)
  );
  return {
    start,
    previousStart: new Date(
      start.getTime() - (now.getTime() - start.getTime())
    ),
    end: now,
  };
}

export const normalizeJobFilter = (
  value: string | null | undefined
): string | null =>
  value && UUID_PATTERN.test(value) ? value : null;

export async function loadRecruitmentReport(
  period: ReportPeriod,
  jobId: string | null
): Promise<ReportData> {
  const range = getReportRange(period);
  const { data, error } = await (await getServerSupabase()).rpc(
    "recruitment_report",
    {
      p_start: range.start ? range.start.toISOString() : null,
      p_end: range.end.toISOString(),
      p_prev_start: range.previousStart
        ? range.previousStart.toISOString()
        : null,
      p_job_id: jobId,
    }
  );

  if (error) throw new RecruitmentError("Laporan belum dapat dimuat", 500);
  return data as ReportData;
}

export type ReportApplicationRow = {
  applicationNumber: string;
  jobTitle: string;
  stage: string;
  source: string;
  appliedAt: string;
  finalAt: string | null;
};

export async function listReportApplications(
  period: ReportPeriod,
  jobId: string | null
): Promise<ReportApplicationRow[]> {
  const range = getReportRange(period);
  const { data, error } = await (await getServerSupabase()).rpc(
    "recruitment_report_applications",
    {
      p_start: range.start ? range.start.toISOString() : null,
      p_end: range.end.toISOString(),
      p_job_id: jobId,
    }
  );

  if (error) throw new RecruitmentError("Data pelamar belum dapat dimuat", 500);

  return (
    (data ?? []) as unknown as {
      application_number: string;
      job_title: string;
      stage: string;
      source: string;
      applied_at: string;
      final_at: string | null;
    }[]
  ).map((row) => ({
    applicationNumber: row.application_number,
    jobTitle: row.job_title,
    stage: row.stage,
    source: row.source,
    appliedAt: row.applied_at,
    finalAt: row.final_at,
  }));
}
