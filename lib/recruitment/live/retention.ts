import type { JobApplication, JobPosting } from "./types";
import { jakartaDate } from "./validation";
import { formatDateID } from "@/lib/datetime";

/** Single source for retention windows. */
export const CV_RETENTION = {
  rejectedDays: 30,
  closedDays: 60,
  warningDays: 7,
} as const;

export const UNIT_MS = 24 * 60 * 60 * 1000;

const PROCESSING_STAGES = [
  "Lamaran Masuk",
  "Screening",
  "Wawancara",
  "Tes",
  "Offering",
] as const;

type RetentionApplication = Pick<
  JobApplication,
  "stage" | "rejected_at" | "cv_deleted_at"
>;
type RetentionJob = Pick<JobPosting, "status" | "closes_at" | "closed_at">;

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * UNIT_MS);
}

function closesAtDate(value: string): Date {
  // closes_at is a date in Jakarta; count the full closing day.
  return new Date(`${value}T23:59:59+07:00`);
}

export function cvRetentionDeadline(
  application: RetentionApplication,
  job: RetentionJob,
  now = new Date(),
): Date | null {
  if (application.cv_deleted_at) return null;

  if (application.stage === "Ditolak") {
    return application.rejected_at
      ? addDays(new Date(application.rejected_at), CV_RETENTION.rejectedDays)
      : null;
  }

  if (
    !PROCESSING_STAGES.includes(
      application.stage as (typeof PROCESSING_STAGES)[number],
    )
  ) {
    return null;
  }

  const autoClosed =
    job.status === "Aktif" &&
    job.closes_at !== null &&
    job.closes_at < jakartaDate(now);
  const scheduledClosed =
    job.closes_at !== null && job.closes_at < jakartaDate(now);

  if (job.status !== "Ditutup" && !autoClosed) return null;

  const deadlines: Date[] = [];
  if (job.status === "Ditutup" && job.closed_at) {
    deadlines.push(addDays(new Date(job.closed_at), CV_RETENTION.closedDays));
  }
  if ((job.status === "Ditutup" || scheduledClosed) && job.closes_at) {
    deadlines.push(
      addDays(closesAtDate(job.closes_at), CV_RETENTION.closedDays),
    );
  }

  return deadlines.length
    ? new Date(Math.min(...deadlines.map((date) => date.getTime())))
    : null;
}

export function cvRetentionWarningAt(
  application: RetentionApplication,
  job: RetentionJob,
  now = new Date(),
): Date | null {
  if (application.cv_deleted_at) return null;
  const deadline = cvRetentionDeadline(application, job, now);
  if (!deadline) return null;
  return deadline.getTime() - now.getTime() <=
    CV_RETENTION.warningDays * UNIT_MS
    ? deadline
    : null;
}

export function formatRetentionDate(value: Date | string): string {
  return formatDateID(value);
}
