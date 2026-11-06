/**
 * Turunan data untuk halaman Overview.
 *
 * Semua angka di dashboard dihitung di sini dari satu snapshot yang sama
 * (`RecruitmentSnapshot`), sehingga kartu statistik, pipeline, aktivitas, dan
 * jadwal tidak mungkin memakai sumber yang berbeda.
 */

import { daysBetween, startOfDay } from "@/lib/recruitment/format";
import type {
  Activity,
  Candidate,
  Interview,
  PipelineMetric,
  StatCard,
} from "@/lib/recruitment/types";
import { STAGES } from "@/lib/data";

export const PIPELINE_STAGES = STAGES.filter((stage) => stage !== "Ditolak");

export const ACTIVE_JOB_STATUS = "Aktif";

const countByStage = (candidates: Candidate[], stage: string) =>
  candidates.filter((candidate) => candidate.stage === stage).length;

/** Kartu statistik atas. Nilai dan keterangannya dihitung dari data. */
export function buildStatCards(
  candidates: Candidate[],
  interviews: Interview[],
  jobs: { st: string; publishedAt: string | null }[],
  now: Date = new Date()
): StatCard[] {
  const activeJobs = jobs.filter((job) => job.st === ACTIVE_JOB_STATUS).length;
  const draftJobs = jobs.filter((job) => job.st === "Draf").length;
  const closedJobs = jobs.filter((job) => job.st === "Ditutup").length;

  const newCandidates = candidates.filter(
    (candidate) => daysBetween(new Date(candidate.appliedAt), now) < 7
  ).length;

  const pendingScreening = countByStage(candidates, "Screening");
  const staleScreening = candidates.filter(
    (candidate) =>
      candidate.stage === "Screening" &&
      daysBetween(new Date(candidate.appliedAt), now) > 3
  ).length;

  const upcoming = upcomingInterviews(interviews, now);
  const todayInterviews = countInterviewsToday(interviews, now);

  const accepted = countByStage(candidates, "Diterima");
  const conversion =
    candidates.length > 0
      ? Math.round((accepted / candidates.length) * 100)
      : 0;

  const jobHint = [
    draftJobs > 0 ? `${draftJobs} draf` : null,
    closedJobs > 0 ? `${closedJobs} ditutup` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    {
      label: "Lowongan Aktif",
      value: activeJobs,
      hint: jobHint || "Belum ada lowongan lain",
    },
    {
      label: "Total Kandidat",
      value: candidates.length,
      hint:
        newCandidates > 0 ? `+${newCandidates} minggu ini` : "Belum ada kandidat baru",
    },
    {
      label: "Menunggu Screening",
      value: pendingScreening,
      hint:
        staleScreening > 0
          ? `${staleScreening} lewat 3 hari`
          : "Semua masih dalam SLA",
      highlight: true,
    },
    {
      label: "Wawancara Terjadwal",
      value: upcoming.length,
      hint: todayInterviews > 0 ? `${todayInterviews} hari ini` : "Tidak ada hari ini",
    },
    {
      label: "Kandidat Diterima",
      value: accepted,
      hint: `${conversion}% konversi`,
    },
  ];
}

/** Jumlah kandidat per tahap beserta konversi terhadap tahap sebelumnya. */
export function buildPipelineMetrics(
  candidates: Candidate[]
): PipelineMetric[] {
  return PIPELINE_STAGES.map((stage, index) => {
    const count = countByStage(candidates, stage);
    const previous =
      index === 0 ? null : countByStage(candidates, PIPELINE_STAGES[index - 1]);
    // Dibatasi 100%: kandidat bisa masuk pipeline dari tahap berbeda,
    // sehingga jumlah satu tahap dapat melebihi tahap sebelumnya.
    const ratio =
      previous && previous > 0
        ? Math.min(100, Math.round((count / previous) * 100))
        : null;
    return { stage, count, conversion: ratio };
  });
}

/** Wawancara yang belum lewat, urut paling dekat. */
export function upcomingInterviews(
  interviews: Interview[],
  now: Date = new Date(),
  limit?: number
): Interview[] {
  const list = interviews
    .filter(
      (interview) =>
        new Date(interview.at).getTime() >= now.getTime() &&
        interview.st !== "Selesai"
    )
    .sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
    );
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

/** Jumlah wawancara yang dijadwalkan hari ini. */
export function countInterviewsToday(
  interviews: Interview[],
  now: Date = new Date()
): number {
  return upcomingInterviews(interviews, now).filter(
    (interview) =>
      startOfDay(new Date(interview.at)).getTime() === startOfDay(now).getTime()
  ).length;
}

/** Aktivitas terbaru lebih dulu. */
export function latestActivities(activities: Activity[]): Activity[] {
  return [...activities].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

