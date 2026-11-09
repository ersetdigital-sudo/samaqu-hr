import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { dbFailure } from "./http";
import { APPLICATION_COLUMNS } from "./repository";
import type {
  CandidateApplication,
  CandidateJob,
  JobApplication,
  RecruitmentBoard,
} from "./types";

/** Batas snapshot agar satu halaman tidak menarik seluruh riwayat lamaran. */
export const CANDIDATE_LIMIT = 500;
const JOB_LIMIT = 500;
const JOB_COLUMNS =
  "id,slug,title,status,closes_at,closed_at,published_at,created_at";

type RawApplication = JobApplication & {
  job: CandidateJob | CandidateJob[] | null;
};

/**
 * Satu snapshot untuk tiga halaman recruitment: dua query tetap, tanpa query
 * per baris. RLS dan role guard tetap berlaku di lapisan pemanggil.
 */
export async function getRecruitmentBoard(): Promise<RecruitmentBoard> {
  const db = await getServerSupabase();
  const [jobsResult, applicationsResult] = await Promise.all([
    db
      .from("job_postings")
      .select(JOB_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(JOB_LIMIT),
    db
      .from("job_applications")
      .select(`${APPLICATION_COLUMNS},job:job_postings(${JOB_COLUMNS})`, {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .order("id")
      .limit(CANDIDATE_LIMIT),
  ]);

  if (jobsResult.error) dbFailure(jobsResult.error);
  if (applicationsResult.error) dbFailure(applicationsResult.error);

  const jobs = (jobsResult.data ?? []) as CandidateJob[];
  const rows = (applicationsResult.data ?? []) as unknown as RawApplication[];
  const applications: CandidateApplication[] = rows.map((row) => {
    const { job, ...application } = row;
    return {
      ...(application as JobApplication),
      job: Array.isArray(job) ? job[0] ?? null : job,
    };
  });

  return {
    jobs,
    applications,
    total: applicationsResult.count ?? applications.length,
    limit: CANDIDATE_LIMIT,
  };
}
