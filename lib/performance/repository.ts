/** Lapisan akses data Performance Management (server-side). */

import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  withPeriodProgress,
} from "@/lib/performance/rules";
import type {
  EmployeePerformanceHistoryEntry,
  MyPerformanceResult,
  PerformanceAspect,
  PerformanceAspectInput,
  PerformanceCategory,
  PerformanceDraftInput,
  PerformanceIneligibleEmployee,
  PerformancePeriod,
  PerformancePeriodDetail,
  PerformancePeriodStatus,
  PerformancePeriodSummary,
  PerformanceReviewDetail,
  PerformanceReviewHistoryEntry,
  PerformanceReviewScore,
  PerformanceReviewStatus,
  PerformanceReviewSummary,
  PerformanceTeamRow,
} from "@/lib/performance/types";

export type PerformanceTechnicalError = {
  code?: string;
  functionName?: string;
  message?: string;
};

export class PerformanceDataError extends Error {
  readonly status: number;
  readonly technical?: PerformanceTechnicalError;
  constructor(
    message: string,
    status = 400,
    technical?: PerformanceTechnicalError
  ) {
    super(message);
    this.name = "PerformanceDataError";
    this.status = status;
    this.technical = technical;
  }
}

const mapDbError = (
  error: { code?: string; message?: string },
  action: string
) => {
  if (error.code === "42501") {
    return new PerformanceDataError(
      "Akses ditolak oleh aturan keamanan data",
      403
    );
  }
  return new PerformanceDataError(
    `Gagal ${action} data penilaian`,
    500,
    { code: error.code, message: error.message }
  );
};

export const mapPerformanceRpcError = (
  error: { message?: string; code?: string },
  functionName: string
) => {
  const message = error.message?.trim() || "Gagal memproses penilaian";
  if (error.code === "42501") return new PerformanceDataError(message, 403);
  if (error.code === "P0002") return new PerformanceDataError(message, 404);
  if (error.code === "P0001") return new PerformanceDataError(message, 400);
  return new PerformanceDataError(
    "Gagal memproses penilaian",
    500,
    { code: error.code, functionName, message }
  );
};

type PeriodRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  due_date: string;
  status: PerformancePeriodStatus;
  ineligible_employees: PerformanceIneligibleEmployee[] | null;
  opened_at: string;
  closed_at: string | null;
};

type ReviewRow = {
  id: string;
  period_id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  position: string;
  reviewer_employee_id: string | null;
  reviewer_name: string | null;
  status: PerformanceReviewStatus;
  final_score: number | null;
  final_category: PerformanceCategory | null;
  return_reason: string | null;
  excluded_reason: string | null;
  achievement_notes: string;
  strengths: string;
  improvement_areas: string;
  general_notes: string;
  updated_at: string;
};

type ScoreRow = {
  id: string;
  aspect_id: string | null;
  aspect_name: string;
  aspect_description: string;
  sort_order: number;
  score: number | null;
  note: string;
};

type HistoryRow = {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  actor_name: string | null;
  acted_at: string;
};

type AspectRow = {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  updated_at: string;
};

const periodFromRow = (row: PeriodRow): PerformancePeriod => ({
  id: row.id,
  name: row.name,
  startDate: row.start_date,
  endDate: row.end_date,
  dueDate: row.due_date,
  status: row.status,
  ineligible: Array.isArray(row.ineligible_employees)
    ? row.ineligible_employees
    : [],
  openedAt: row.opened_at,
  closedAt: row.closed_at,
});

const reviewFromRow = (row: ReviewRow): PerformanceReviewSummary => ({
  id: row.id,
  periodId: row.period_id,
  employeeId: row.employee_id,
  employeeName: row.employee_name,
  department: row.department,
  position: row.position,
  reviewerEmployeeId: row.reviewer_employee_id,
  reviewerName: row.reviewer_name,
  status: row.status,
  finalScore: row.final_score,
  finalCategory: row.final_category,
  returnReason: row.return_reason,
  excludedReason: row.excluded_reason,
  updatedAt: row.updated_at,
});

const scoreFromRow = (row: ScoreRow): PerformanceReviewScore => ({
  id: row.id,
  aspectId: row.aspect_id,
  aspectName: row.aspect_name,
  aspectDescription: row.aspect_description,
  sortOrder: row.sort_order,
  score: row.score,
  note: row.note,
});

export async function listPerformancePeriods(): Promise<
  PerformancePeriodSummary[]
> {
  const db = await getServerSupabase();
  const [periodResult, reviewResult] = await Promise.all([
    db
      .from("performance_periods")
      .select(
        "id, name, start_date, end_date, due_date, status, ineligible_employees, opened_at, closed_at"
      )
      .order("start_date", { ascending: false }),
    db.from("performance_reviews").select("period_id, status"),
  ]);
  if (periodResult.error) throw mapDbError(periodResult.error, "memuat periode");
  if (reviewResult.error) throw mapDbError(reviewResult.error, "memuat lembar");

  const reviewsByPeriod = new Map<
    string,
    { status: PerformanceReviewStatus }[]
  >();
  for (const row of (reviewResult.data ?? []) as {
    period_id: string;
    status: PerformanceReviewStatus;
  }[]) {
    const list = reviewsByPeriod.get(row.period_id) ?? [];
    list.push({ status: row.status });
    reviewsByPeriod.set(row.period_id, list);
  }

  return ((periodResult.data ?? []) as PeriodRow[]).map((row) =>
    withPeriodProgress(periodFromRow(row), reviewsByPeriod.get(row.id) ?? [])
  );
}

export async function getPerformancePeriodDetail(
  periodId: string
): Promise<PerformancePeriodDetail | null> {
  const db = await getServerSupabase();
  const periodResult = await db
    .from("performance_periods")
    .select(
      "id, name, start_date, end_date, due_date, status, ineligible_employees, opened_at, closed_at"
    )
    .eq("id", periodId)
    .maybeSingle();
  if (periodResult.error) throw mapDbError(periodResult.error, "memuat periode");
  if (!periodResult.data) return null;

  const reviewResult = await db
    .from("performance_reviews")
    .select("*")
    .eq("period_id", periodId)
    .order("employee_name", { ascending: true });
  if (reviewResult.error) throw mapDbError(reviewResult.error, "memuat lembar");

  const reviews = ((reviewResult.data ?? []) as ReviewRow[]).map(reviewFromRow);
  return {
    period: withPeriodProgress(periodFromRow(periodResult.data as PeriodRow), reviews),
    reviews,
  };
}

export async function getPerformanceReviewDetail(
  reviewId: string
): Promise<PerformanceReviewDetail | null> {
  const db = await getServerSupabase();
  const reviewResult = await db
    .from("performance_reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();
  if (reviewResult.error) throw mapDbError(reviewResult.error, "memuat lembar");
  if (!reviewResult.data) return null;

  const review = reviewResult.data as ReviewRow;
  const [periodResult, scoreResult, historyResult] = await Promise.all([
    db
      .from("performance_periods")
      .select(
        "id, name, start_date, end_date, due_date, status, ineligible_employees, opened_at, closed_at"
      )
      .eq("id", review.period_id)
      .maybeSingle(),
    db
      .from("performance_review_scores")
      .select(
        "id, aspect_id, aspect_name, aspect_description, sort_order, score, note"
      )
      .eq("review_id", reviewId)
      .order("sort_order", { ascending: true }),
    db
      .from("performance_review_history")
      .select(
        "id, action, from_status, to_status, reason, actor_name, acted_at"
      )
      .eq("review_id", reviewId)
      .order("acted_at", { ascending: false }),
  ]);
  if (periodResult.error) throw mapDbError(periodResult.error, "memuat periode");
  if (scoreResult.error) throw mapDbError(scoreResult.error, "memuat skor");
  if (historyResult.error) throw mapDbError(historyResult.error, "memuat riwayat");
  if (!periodResult.data) return null;

  const period = periodFromRow(periodResult.data as PeriodRow);
  const summary = reviewFromRow(review);

  return {
    ...summary,
    periodName: period.name,
    periodStatus: period.status,
    periodStartDate: period.startDate,
    periodEndDate: period.endDate,
    periodDueDate: period.dueDate,
    achievementNotes: review.achievement_notes,
    strengths: review.strengths,
    improvementAreas: review.improvement_areas,
    generalNotes: review.general_notes,
    scores: ((scoreResult.data ?? []) as ScoreRow[]).map(scoreFromRow),
    history: ((historyResult.data ?? []) as HistoryRow[]).map(
      (row): PerformanceReviewHistoryEntry => ({
        id: row.id,
        action: row.action,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        reason: row.reason,
        actorName: row.actor_name ?? "Sistem",
        actedAt: row.acted_at,
      })
    ),
  };
}

export async function listPerformanceAspects(): Promise<PerformanceAspect[]> {
  const { data, error } = await (await getServerSupabase())
    .from("performance_aspects")
    .select("id, name, description, sort_order, is_active, updated_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw mapDbError(error, "memuat aspek");
  return ((data ?? []) as AspectRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  }));
}

export async function hasOpenPerformanceAssignment(
  employeeId: string | null
): Promise<boolean> {
  if (!employeeId) return false;
  const db = await getServerSupabase();
  const periodResult = await db
    .from("performance_periods")
    .select("id")
    .eq("status", "Terbuka");
  if (periodResult.error) return false;
  const periodIds = ((periodResult.data ?? []) as { id: string }[]).map(
    (row) => row.id
  );
  if (periodIds.length === 0) return false;

  const reviewResult = await db
    .from("performance_reviews")
    .select("id")
    .eq("reviewer_employee_id", employeeId)
    .in("period_id", periodIds)
    .limit(1)
    .maybeSingle();
  return Boolean(reviewResult.data);
}

export async function getPerformanceTeamRows(
  reviewerEmployeeId: string | null
): Promise<PerformanceTeamRow[]> {  if (!reviewerEmployeeId) return [];
  const db = await getServerSupabase();
  const periodResult = await db
    .from("performance_periods")
    .select("id, name, end_date, due_date")
    .eq("status", "Terbuka");
  if (periodResult.error) throw mapDbError(periodResult.error, "memuat periode");
  const periods = new Map(
    ((periodResult.data ?? []) as {
      id: string;
      name: string;
      end_date: string;
      due_date: string;
    }[]).map((row) => [row.id, row])
  );
  if (periods.size === 0) return [];

  const reviewResult = await db
    .from("performance_reviews")
    .select("*")
    .eq("reviewer_employee_id", reviewerEmployeeId)
    .in("period_id", [...periods.keys()])
    .order("employee_name", { ascending: true });
  if (reviewResult.error) throw mapDbError(reviewResult.error, "memuat penugasan");

  return ((reviewResult.data ?? []) as ReviewRow[]).flatMap((row) => {
    const period = periods.get(row.period_id);
    if (!period) return [];
    return [
      {
        ...reviewFromRow(row),
        periodName: period.name,
        periodEndDate: period.end_date,
        periodDueDate: period.due_date,
      },
    ];
  });
}

export async function getMyPerformanceResults(
  employeeId: string | null
): Promise<MyPerformanceResult[]> {
  if (!employeeId) return [];
  const db = await getServerSupabase();
  const reviewResult = await db
    .from("performance_reviews")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("status", "Final");
  if (reviewResult.error) throw mapDbError(reviewResult.error, "memuat hasil");

  const reviews = (reviewResult.data ?? []) as ReviewRow[];
  if (reviews.length === 0) return [];

  const periodResult = await db
    .from("performance_periods")
    .select("id, name, start_date, end_date, status")
    .in("id", [...new Set(reviews.map((review) => review.period_id))])
    .eq("status", "Ditutup");
  if (periodResult.error) throw mapDbError(periodResult.error, "memuat periode");
  const periods = new Map(
    ((periodResult.data ?? []) as {
      id: string;
      name: string;
      start_date: string;
      end_date: string;
    }[]).map((row) => [row.id, row])
  );

  const visible = reviews.filter(
    (review) => periods.has(review.period_id) && review.final_score !== null
  );
  if (visible.length === 0) return [];

  const scoreResult = await db
    .from("performance_review_scores")
    .select(
      "id, aspect_id, aspect_name, aspect_description, sort_order, score, note, review_id"
    )
    .in("review_id", visible.map((review) => review.id))
    .order("sort_order", { ascending: true });
  if (scoreResult.error) throw mapDbError(scoreResult.error, "memuat skor");
  const scoresByReview = new Map<string, PerformanceReviewScore[]>();
  for (const row of (scoreResult.data ?? []) as (ScoreRow & {
    review_id: string;
  })[]) {
    const list = scoresByReview.get(row.review_id) ?? [];
    list.push(scoreFromRow(row));
    scoresByReview.set(row.review_id, list);
  }

  return visible
    .map((review): MyPerformanceResult => {
      const period = periods.get(review.period_id)!;
      return {
        reviewId: review.id,
        periodId: review.period_id,
        periodName: period.name,
        periodStartDate: period.start_date,
        periodEndDate: period.end_date,
        finalScore: review.final_score ?? 0,
        finalCategory: review.final_category ?? "Perlu Perbaikan",
        achievementNotes: review.achievement_notes,
        strengths: review.strengths,
        improvementAreas: review.improvement_areas,
        generalNotes: review.general_notes,
        scores: scoresByReview.get(review.id) ?? [],
      };
    })
    .sort((a, b) => b.periodEndDate.localeCompare(a.periodEndDate));
}

export async function getEmployeePerformanceHistory(
  employeeId: string
): Promise<EmployeePerformanceHistoryEntry[]> {
  const db = await getServerSupabase();
  const reviewResult = await db
    .from("performance_reviews")
    .select("id, period_id, final_score, final_category")
    .eq("employee_id", employeeId)
    .eq("status", "Final");
  if (reviewResult.error) throw mapDbError(reviewResult.error, "memuat performa");

  const reviews = (reviewResult.data ?? []) as {
    id: string;
    period_id: string;
    final_score: number | null;
    final_category: PerformanceCategory | null;
  }[];
  if (reviews.length === 0) return [];

  const periodResult = await db
    .from("performance_periods")
    .select("id, name, end_date")
    .in("id", [...new Set(reviews.map((review) => review.period_id))]);
  if (periodResult.error) throw mapDbError(periodResult.error, "memuat periode");
  const periods = new Map(
    ((periodResult.data ?? []) as {
      id: string;
      name: string;
      end_date: string;
    }[]).map((row) => [row.id, row])
  );

  return reviews
    .flatMap((review) => {
      const period = periods.get(review.period_id);
      if (!period || review.final_score === null) return [];
      return [
        {
          reviewId: review.id,
          periodName: period.name,
          periodEndDate: period.end_date,
          finalScore: review.final_score,
          finalCategory: review.final_category ?? "Perlu Perbaikan",
        },
      ];
    })
    .sort((a, b) => b.periodEndDate.localeCompare(a.periodEndDate));
}

export async function createPerformancePeriod(input: {
  name: string;
  startDate: string;
  endDate: string;
  dueDate: string;
}): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "create_performance_period",
    {
      p_name: input.name,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_due_date: input.dueDate,
    }
  );
  if (error) throw mapPerformanceRpcError(error, "create_performance_period");
}

export async function savePerformanceAspect(
  aspectId: string | null,
  input: PerformanceAspectInput
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "save_performance_aspect",
    {
      p_aspect_id: aspectId,
      p_name: input.name,
      p_description: input.description,
      p_sort_order: input.sortOrder,
      p_is_active: input.isActive,
    }
  );
  if (error) throw mapPerformanceRpcError(error, "save_performance_aspect");
}

export async function setPerformanceReviewer(
  reviewId: string,
  reviewerEmployeeId: string,
  reason: string
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "set_performance_reviewer",
    {
      p_review_id: reviewId,
      p_reviewer_employee_id: reviewerEmployeeId,
      p_reason: reason,
    }
  );
  if (error) throw mapPerformanceRpcError(error, "set_performance_reviewer");
}

export async function savePerformanceDraft(
  reviewId: string,
  input: PerformanceDraftInput
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "save_performance_draft",
    {
      p_review_id: reviewId,
      // Kontrak JSON fungsi database: snake_case.
      p_scores: input.scores.map((score) => ({
        score_id: score.scoreId,
        score: score.score,
        note: score.note,
      })),
      p_achievement_notes: input.achievementNotes,
      p_strengths: input.strengths,
      p_improvement_areas: input.improvementAreas,
      p_general_notes: input.generalNotes,
    }
  );
  if (error) throw mapPerformanceRpcError(error, "save_performance_draft");
}

export async function submitPerformanceReview(reviewId: string): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "submit_performance_review",
    { p_review_id: reviewId }
  );
  if (error) throw mapPerformanceRpcError(error, "submit_performance_review");
}

export async function returnPerformanceReview(
  reviewId: string,
  reason: string
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "return_performance_review",
    { p_review_id: reviewId, p_reason: reason }
  );
  if (error) throw mapPerformanceRpcError(error, "return_performance_review");
}

export async function approvePerformanceReview(reviewId: string): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "approve_performance_review",
    { p_review_id: reviewId }
  );
  if (error) throw mapPerformanceRpcError(error, "approve_performance_review");
}

export async function excludePerformanceReview(
  reviewId: string,
  reason: string
): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "exclude_performance_review",
    { p_review_id: reviewId, p_reason: reason }
  );
  if (error) throw mapPerformanceRpcError(error, "exclude_performance_review");
}

export async function closePerformancePeriod(periodId: string): Promise<void> {
  const { error } = await (await getServerSupabase()).rpc(
    "close_performance_period",
    { p_period_id: periodId }
  );
  if (error) throw mapPerformanceRpcError(error, "close_performance_period");
}
