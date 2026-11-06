/**
 * Lapisan akses data modul Recruitment (server-side).
 *
 * Saat ini sumber datanya adalah dataset lokal di `seed.ts`. Semua pemanggil
 * (layout server, route API) hanya bergantung pada `getRecruitmentSnapshot()`,
 * jadi mengganti ke database cukup dengan mengubah isi fungsi ini:
 *
 *   const jobs = await db.job.findMany({ where: { deletedAt: null } });
 *   const candidates = await db.candidate.findMany();
 *   ...
 *
 * Bentuk yang dikembalikan tetap `RecruitmentSnapshot` (lihat `types.ts`),
 * sehingga tidak ada komponen UI yang perlu diubah.
 */

import {
  formatClockID,
  formatDateID,
  formatDayLabelID,
  formatRelativeID,
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
} from "@/lib/recruitment/format";
import {
  ACTIVITY_SEEDS,
  CANDIDATE_SEEDS,
  CANDIDATE_SOURCES,
  INTERVIEW_SEEDS,
  JOB_SEEDS,
} from "@/lib/recruitment/seed";
import type {
  Activity,
  Candidate,
  Interview,
  Job,
  RecruitmentSnapshot,
} from "@/lib/recruitment/types";

const dateFromDaysAgo = (days: number, now: Date) =>
  new Date(now.getTime() - days * DAY_MS);

const buildJobs = (now: Date): Job[] =>
  JOB_SEEDS.map((seed) => {
    const publishedAt =
      seed.publishedDaysAgo === null
        ? null
        : dateFromDaysAgo(seed.publishedDaysAgo, now);
    const deadline =
      publishedAt === null
        ? null
        : new Date(publishedAt.getTime() + seed.deadlineInDays * DAY_MS);

    return {
      id: seed.id,
      pos: seed.pos,
      dep: seed.dep,
      st: seed.st,
      n: seed.n,
      pub: publishedAt ? formatDateID(publishedAt) : "—",
      dl: deadline ? formatDateID(deadline) : "—",
      publishedAt: publishedAt ? publishedAt.toISOString() : null,
    };
  });

const buildCandidates = (now: Date): Candidate[] =>
  CANDIDATE_SEEDS.map((seed, index) => ({
    id: index,
    name: seed.name,
    pos: seed.pos,
    stage: seed.stage,
    note: seed.note,
    score: seed.score,
    src: CANDIDATE_SOURCES[index % CANDIDATE_SOURCES.length],
    appliedAt: dateFromDaysAgo(seed.appliedDaysAgo, now).toISOString(),
  }));

const buildInterviews = (now: Date): Interview[] =>
  INTERVIEW_SEEDS.map((seed, index) => {
    const at = new Date(now.getTime() + seed.startsInHours * HOUR_MS);
    // Bulatkan ke 30 menit terdekat supaya jadwal terbaca wajar (10:00, 13:30).
    at.setMinutes(Math.round(at.getMinutes() / 30) * 30, 0, 0);
    return {
      id: `interview-${index + 1}`,
      d: formatDayLabelID(at, now),
      t: formatClockID(at),
      c: seed.c,
      p: seed.p,
      i: seed.i,
      m: seed.m,
      st: seed.st,
      at: at.toISOString(),
    };
  });

const buildActivities = (now: Date): Activity[] =>
  ACTIVITY_SEEDS.map((seed, index) => {
    const at = new Date(now.getTime() - seed.minutesAgo * MINUTE_MS);
    return {
      id: `activity-${index + 1}`,
      actor: seed.actor,
      before: seed.before,
      subject: seed.subject,
      after: seed.after,
      at: at.toISOString(),
      label: formatRelativeID(at, now),
    };
  });

/**
 * Snapshot lengkap modul rekrutmen. Dipakai oleh layout server (initial data)
 * dan oleh route API (refresh dari klien).
 */
export async function getRecruitmentSnapshot(): Promise<RecruitmentSnapshot> {
  const now = new Date();
  return {
    jobs: buildJobs(now),
    candidates: buildCandidates(now),
    interviews: buildInterviews(now),
    activities: buildActivities(now),
  };
}
