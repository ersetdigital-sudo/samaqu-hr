import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { getDailyAttendance } from "@/lib/attendance/repository";
import {
  buildAttendanceDailyRows,
  buildAttendanceDailySummary,
} from "@/lib/attendance/query";
import { isoWeekday } from "@/lib/attendance/rules";
import { isoDateJakarta } from "@/lib/datetime";
import { ACTIVE_WORKING_STATUSES } from "@/lib/employees/types";
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
  activeWorking: number;
  active: number;
  probation: number;
  joinedThisMonth: number;
};

export type AttendanceDashboardStats = {
  date: string;
  kind: "workday" | "holiday" | "offday" | "no-schedule";
  checkedIn: number;
  totalActive: number;
  late: number;
  note: string | null;
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
  const todayIso = isoDateJakarta();

  const [activeResult, probationResult, joinedResult] = await Promise.all([
    db
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("status", "Aktif")
      .lte("joined_at", todayIso),
    db
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("status", "Probation")
      .lte("joined_at", todayIso),
    db
      .from("employees")
      .select("id", { count: "exact", head: true })
      .in("status", [...ACTIVE_WORKING_STATUSES])
      .gte("joined_at", start)
      .lt("joined_at", next)
      .lte("joined_at", todayIso),
  ]);

  if (activeResult.error || probationResult.error || joinedResult.error) {
    throw new Error("Data karyawan belum dapat dimuat");
  }

  const active = activeResult.count ?? 0;
  const probation = probationResult.count ?? 0;
  return {
    activeWorking: active + probation,
    active,
    probation,
    joinedThisMonth: joinedResult.count ?? 0,
  };
}

/** Angka kehadiran hari ini memakai sumber dan builder yang sama dengan halaman harian. */
export async function getAttendanceDashboardStats(
  dateIso = isoDateJakarta()
): Promise<AttendanceDashboardStats> {
  const data = await getDailyAttendance(dateIso);
  const rows = buildAttendanceDailyRows({
    date: data.date,
    todayIso: data.todayIso,
    employees: data.employees,
    attendance: data.attendance,
    corrections: data.corrections,
    schedule: data.schedule,
    holiday: data.holiday,
    leaveStatuses: data.leaveStatuses,
    overtimeStatuses: data.overtimeStatuses,
  });
  const totalActive = data.employees.length;

  if (data.holiday) {
    return {
      date: data.date,
      kind: "holiday",
      checkedIn: 0,
      totalActive,
      late: 0,
      note: `Hari libur: ${data.holiday.name}`,
    };
  }
  if (!data.schedule) {
    return {
      date: data.date,
      kind: "no-schedule",
      checkedIn: 0,
      totalActive,
      late: 0,
      note: "Jadwal kerja belum diatur.",
    };
  }
  if (!data.schedule.workDays.includes(isoWeekday(data.date))) {
    return {
      date: data.date,
      kind: "offday",
      checkedIn: 0,
      totalActive,
      late: 0,
      note: "Hari ini bukan hari kerja.",
    };
  }

  const summary = buildAttendanceDailySummary(rows);
  return {
    date: data.date,
    kind: "workday",
    checkedIn: rows.filter((row) => Boolean(row.day.record?.checkInAt)).length,
    totalActive,
    late: summary.terlambat,
    note: null,
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
