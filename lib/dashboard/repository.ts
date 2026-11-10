import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { getRecruitmentOverviewBoard } from "@/lib/recruitment/live/candidates";
import {
  getInterviewDashboardStats,
  listRecentInterviews,
  type RecentInterview,
} from "@/lib/recruitment/live/interviews";
import { buildRecruitmentOverview } from "@/lib/recruitment/live/overview";
import { formatRelativeID } from "@/lib/recruitment/format";
import type { OverviewBoard } from "@/lib/recruitment/live/types";
import type { Activity } from "@/lib/recruitment/types";

export type RecruitmentDashboard = {
  activeJobs: number;
  totalCandidates: number;
  pendingScreening: number;
  newLast7Days: number;
  jobHint: string;
  upcomingInterviews: number;
  todayInterviews: number;
  activities: Activity[];
};

export type EmployeeDashboardStats = {
  active: number;
  joinedThisMonth: number;
};

export type OwnEmployeeProfile = {
  id: string;
  fullName: string;
  position: string;
  department: string;
  location: string;
  status: string;
  joinedAt: string;
};

/** Hanya kejadian yang benar-benar tercatat: lamaran masuk & jadwal dibuat. */
function buildActivities(
  board: OverviewBoard,
  recentInterviews: RecentInterview[],
  now = new Date()
): Activity[] {
  const jobTitles = new Map(board.jobs.map((job) => [job.id, job.title] as const));

  const applications: Activity[] = board.applications
    .slice(0, 6)
    .map((application) => ({
      id: `application-${application.id}`,
      actor: application.full_name,
      before: " melamar sebagai ",
      subject: jobTitles.get(application.job_id) ?? "lowongan",
      after: "",
      at: application.created_at,
      label: formatRelativeID(new Date(application.created_at), now),
    }));

  const interviews: Activity[] = recentInterviews.map((interview) => ({
    id: `interview-${interview.id}`,
    actor: interview.applicant_name,
    before: " dijadwalkan wawancara untuk posisi ",
    subject: interview.job_title,
    after: "",
    at: interview.created_at,
    label: formatRelativeID(new Date(interview.created_at), now),
  }));

  return [...applications, ...interviews]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5);
}

/** Ringkasan rekrutmen untuk Recruiter, HR Manager, dan Admin. */
export async function getRecruitmentDashboardData(): Promise<RecruitmentDashboard> {
  const [board, interviewStats, recentInterviews] = await Promise.all([
    getRecruitmentOverviewBoard(),
    getInterviewDashboardStats(),
    listRecentInterviews(6),
  ]);
  const overview = buildRecruitmentOverview(board);

  return {
    activeJobs: overview.activeJobs,
    totalCandidates: board.total,
    pendingScreening: overview.pendingScreening,
    newLast7Days: overview.newLast7Days,
    jobHint: overview.stats[0]?.hint ?? "",
    upcomingInterviews: interviewStats.upcoming,
    todayInterviews: interviewStats.today,
    activities: buildActivities(board, recentInterviews),
  };
}

const JAKARTA_MONTH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
});

function jakartaMonthRange(now: Date) {
  const value = JAKARTA_MONTH.format(now);
  const [year, month] = value.split("-").map(Number);
  return {
    start: `${value}-01`,
    next:
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`,
  };
}

/** Angka karyawan asli; hanya dipanggil untuk HR Manager dan Admin. */
export async function getEmployeeDashboardStats(
  now = new Date()
): Promise<EmployeeDashboardStats> {
  const db = await getServerSupabase();
  const { start, next } = jakartaMonthRange(now);

  const [activeResult, joinedResult] = await Promise.all([
    db
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("status", "Aktif"),
    db
      .from("employees")
      .select("id", { count: "exact", head: true })
      .neq("status", "Nonaktif")
      .gte("joined_at", start)
      .lt("joined_at", next),
  ]);

  if (activeResult.error || joinedResult.error)
    throw new Error("Data karyawan belum dapat dimuat");

  return {
    active: activeResult.count ?? 0,
    joinedThisMonth: joinedResult.count ?? 0,
  };
}

/** Data karyawan milik akun Employee sendiri (RLS self-read). */
export async function getOwnEmployeeProfile(
  employeeId: string
): Promise<OwnEmployeeProfile | null> {
  const { data, error } = await (await getServerSupabase())
    .from("employees")
    .select("id,full_name,position,department,location,status,joined_at")
    .eq("id", employeeId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    id: string;
    full_name: string;
    position: string;
    department: string;
    location: string;
    status: string;
    joined_at: string;
  };

  return {
    id: row.id,
    fullName: row.full_name,
    position: row.position,
    department: row.department,
    location: row.location,
    status: row.status,
    joinedAt: row.joined_at,
  };
}
