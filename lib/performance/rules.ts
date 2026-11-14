/** Aturan murni Performance Management (tanpa akses database). */

import type {
  PerformanceCategory,
  PerformancePeriodSummary,
  PerformanceReviewDetail,
  PerformanceReviewFilters,
  PerformanceReviewStatus,
  PerformanceReviewSummary,
  PerformanceScore,
  PerformanceStatusCounts,
} from "@/lib/performance/types";
import {
  PERFORMANCE_REVIEW_STATUSES,
  PERFORMANCE_SCORE_LABELS,
} from "@/lib/performance/types";

export const scoreLabel = (score: number): string =>
  PERFORMANCE_SCORE_LABELS[score as PerformanceScore] ?? "—";

export const scoreNeedsNote = (score: number | null): boolean =>
  score !== null && (score === 1 || score === 2 || score === 5);

export function performanceCategory(score: number): PerformanceCategory {
  if (score >= 4.5) return "Sangat Baik";
  if (score >= 3.5) return "Baik";
  if (score >= 2.5) return "Cukup";
  return "Perlu Perbaikan";
}

export function performanceAverage(scores: (number | null)[]): number | null {
  if (scores.length === 0 || scores.some((score) => score === null)) {
    return null;
  }
  const total = scores.reduce<number>(
    (sum, score) => sum + (score ?? 0),
    0
  );
  return Math.round((total / scores.length) * 100) / 100;
}

export function formatPerformanceScore(
  score: number | null | undefined
): string {
  if (score === null || score === undefined) return "—";
  return score.toFixed(2).replace(".", ",");
}

export function emptyStatusCounts(): PerformanceStatusCounts {
  return Object.fromEntries(
    PERFORMANCE_REVIEW_STATUSES.map((status) => [status, 0])
  ) as PerformanceStatusCounts;
}

export function buildStatusCounts(
  reviews: Pick<PerformanceReviewSummary, "status">[]
): PerformanceStatusCounts {
  const counts = emptyStatusCounts();
  for (const review of reviews) counts[review.status] += 1;
  return counts;
}

export function buildPeriodProgress(
  reviews: Pick<PerformanceReviewSummary, "status">[]
): { counts: PerformanceStatusCounts; progressPercent: number } {
  const counts = buildStatusCounts(reviews);
  const total = reviews.length;
  const progressPercent =
    total === 0 ? 0 : Math.round((counts.Final / total) * 100);
  return { counts, progressPercent };
}

export function withPeriodProgress(
  period: Omit<PerformancePeriodSummary, "counts" | "reviewCount" | "progressPercent">,
  reviews: Pick<PerformanceReviewSummary, "status">[]
): PerformancePeriodSummary {
  const { counts, progressPercent } = buildPeriodProgress(reviews);
  return {
    ...period,
    counts,
    reviewCount: reviews.length,
    progressPercent,
  };
}

export function performanceStatusTone(status: PerformanceReviewStatus): string {
  switch (status) {
    case "Final":
      return "t-ok";
    case "Dikirim":
      return "t-info";
    case "Dikembalikan":
      return "t-warn";
    case "Tidak lengkap":
      return "t-bad";
    default:
      return "t-mute";
  }
}

export function periodStatusTone(status: string): string {
  return status === "Terbuka" ? "t-ok" : "t-mute";
}

export function reviewerLabel(
  reviewerName: string | null | undefined
): string {
  return reviewerName?.trim() ? reviewerName : "Belum ada penilai";
}

export function performanceDepartmentOptions(
  reviews: Pick<PerformanceReviewSummary, "department">[]
): string[] {
  return [...new Set(reviews.map((review) => review.department))].sort(
    (a, b) => a.localeCompare(b, "id")
  );
}

export function performanceReviewerOptions(
  reviews: Pick<PerformanceReviewSummary, "reviewerName">[]
): string[] {
  return [
    ...new Set(reviews.map((review) => reviewerLabel(review.reviewerName))),
  ].sort((a, b) => a.localeCompare(b, "id"));
}

export function filterPerformanceReviews<T extends PerformanceReviewSummary>(
  reviews: T[],
  filters: PerformanceReviewFilters
): T[] {
  const query = filters.q.trim().toLocaleLowerCase("id-ID");
  return reviews.filter((review) => {
    if (
      query &&
      !`${review.employeeName} ${review.employeeId} ${review.position}`
        .toLocaleLowerCase("id-ID")
        .includes(query)
    ) {
      return false;
    }
    if (filters.department !== "Semua" && review.department !== filters.department) {
      return false;
    }
    if (filters.status !== "Semua" && review.status !== filters.status) {
      return false;
    }
    if (
      filters.reviewer !== "Semua" &&
      reviewerLabel(review.reviewerName) !== filters.reviewer
    ) {
      return false;
    }
    return true;
  });
}

/** Validasi yang sama dengan fungsi database; dipakai untuk pesan cepat di UI. */
export function performanceReviewIssues(
  review: Pick<
    PerformanceReviewDetail,
    "scores" | "achievementNotes"
  >
): string[] {
  const issues: string[] = [];
  if (review.scores.some((score) => score.score === null)) {
    issues.push("Semua aspek wajib diberi skor sebelum dikirim.");
  }
  if (!review.achievementNotes.trim()) {
    issues.push("Catatan Pencapaian Utama wajib diisi sebelum dikirim.");
  }
  const missingNotes = review.scores.filter(
    (score) => scoreNeedsNote(score.score) && !score.note.trim()
  );
  if (missingNotes.length > 0) {
    issues.push(
      `Catatan wajib diisi untuk aspek: ${missingNotes
        .map((score) => score.aspectName)
        .join(", ")} (skor 1, 2, atau 5).`
    );
  }
  return issues;
}

export function trendLabel(current: number, previous: number | null): string {
  if (previous === null) return "Baru";
  const diff = Math.round((current - previous) * 100) / 100;
  if (diff === 0) return "Stabil";
  return `${diff > 0 ? "+" : ""}${formatPerformanceScore(diff)}`;
}

export function formatReviewPeriod(
  startDate: string,
  endDate: string
): string {
  return `${startDate.slice(8, 10)}/${startDate.slice(5, 7)}/${startDate.slice(0, 4)} – ${endDate.slice(8, 10)}/${endDate.slice(5, 7)}/${endDate.slice(0, 4)}`;
}
