import { STAGES } from "@/lib/data";
import { formatRelativeID } from "@/lib/recruitment/format";
import type {
  Activity,
  PipelineMetric,
  StatCard,
} from "@/lib/recruitment/types";
import type { RecruitmentBoard } from "./types";
import { effectiveStatus } from "./validation";

const DAY_MS = 86_400_000;

export type OverviewTopJob = {
  id: string;
  title: string;
  count: number;
};

export type RecruitmentOverview = {
  stats: StatCard[];
  pipeline: PipelineMetric[];
  activities: Activity[];
  topJobs: OverviewTopJob[];
  pendingScreening: number;
  newLast7Days: number;
  activeJobs: number;
  total: number;
};

/** Ringkasan Overview dari snapshot live; tidak membaca data seed. */
export function buildRecruitmentOverview(
  board: RecruitmentBoard,
  now = new Date(),
): RecruitmentOverview {
  const stageCounts = Object.fromEntries(
    STAGES.map((stage) => [stage, 0]),
  ) as Record<string, number>;
  for (const application of board.applications)
    stageCounts[application.stage] =
      (stageCounts[application.stage] ?? 0) + 1;

  const activeJobs = board.jobs.filter(
    (job) => effectiveStatus(job.status, job.closes_at) === "Aktif",
  ).length;
  const draftJobs = board.jobs.filter((job) => job.status === "Draf").length;
  const closedJobs = board.jobs.filter(
    (job) => effectiveStatus(job.status, job.closes_at) === "Ditutup",
  ).length;

  const newLast7Days = board.applications.filter(
    (application) =>
      now.getTime() - new Date(application.created_at).getTime() <= 7 * DAY_MS,
  ).length;
  const pendingScreening = stageCounts["Screening"] ?? 0;
  const accepted = stageCounts["Diterima"] ?? 0;
  const conversion =
    board.total > 0 ? Math.round((accepted / board.total) * 100) : 0;

  const pipeline: PipelineMetric[] = STAGES.map((stage, index) => {
    const count = stageCounts[stage] ?? 0;
    const previousStage = index === 0 ? null : STAGES[index - 1];
    const previous = previousStage ? stageCounts[previousStage] ?? 0 : 0;
    const ratio =
      stage !== "Ditolak" && previousStage && previous > 0
        ? Math.min(100, Math.round((count / previous) * 100))
        : null;
    return { stage, count, conversion: ratio };
  });

  const activities: Activity[] = board.applications.slice(0, 5).map((item) => ({
    id: item.id,
    actor: item.full_name,
    before: " melamar ",
    subject: item.job?.title ?? "lowongan",
    after: ` · ${item.stage}`,
    at: item.created_at,
    label: formatRelativeID(new Date(item.created_at), now),
  }));

  const jobCounts = new Map<string, { title: string; count: number }>();
  for (const application of board.applications) {
    const current = jobCounts.get(application.job_id) ?? {
      title: application.job?.title ?? "Lowongan",
      count: 0,
    };
    current.count += 1;
    jobCounts.set(application.job_id, current);
  }
  const topJobs: OverviewTopJob[] = [...jobCounts.entries()]
    .map(([id, value]) => ({ id, title: value.title, count: value.count }))
    .sort(
      (a, b) => b.count - a.count || a.title.localeCompare(b.title, "id"),
    )
    .slice(0, 5);

  const jobHint =
    [
      draftJobs > 0 ? `${draftJobs} draf` : null,
      closedJobs > 0 ? `${closedJobs} ditutup` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Belum ada lowongan lain";

  const stats: StatCard[] = [
    { label: "Lowongan Aktif", value: activeJobs, hint: jobHint },
    {
      label: "Total Pelamar",
      value: board.total,
      hint:
        newLast7Days > 0
          ? `+${newLast7Days} minggu ini`
          : "Belum ada pelamar baru",
    },
    {
      label: "Menunggu Screening",
      value: pendingScreening,
      hint:
        pendingScreening > 0 ? "Perlu ditinjau" : "Tidak ada antrean",
      highlight: true,
    },
    {
      label: "Pelamar 7 Hari",
      value: newLast7Days,
      hint: "Lamaran terbaru",
    },
    {
      label: "Kandidat Diterima",
      value: accepted,
      hint: `${conversion}% konversi`,
    },
  ];

  return {
    stats,
    pipeline,
    activities,
    topJobs,
    pendingScreening,
    newLast7Days,
    activeJobs,
    total: board.total,
  };
}
