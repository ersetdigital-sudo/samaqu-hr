export const PERFORMANCE_REVIEW_STATUSES = [
  "Draft",
  "Dikirim",
  "Dikembalikan",
  "Final",
  "Dikecualikan",
  "Tidak lengkap",
] as const;

export type PerformanceReviewStatus =
  (typeof PERFORMANCE_REVIEW_STATUSES)[number];

export const PERFORMANCE_PERIOD_STATUSES = ["Terbuka", "Ditutup"] as const;
export type PerformancePeriodStatus =
  (typeof PERFORMANCE_PERIOD_STATUSES)[number];

export const PERFORMANCE_SCORE_LABELS = {
  1: "Perlu perbaikan besar",
  2: "Di bawah harapan",
  3: "Sesuai harapan",
  4: "Di atas harapan",
  5: "Sangat menonjol",
} as const;

export type PerformanceScore = keyof typeof PERFORMANCE_SCORE_LABELS;

export const PERFORMANCE_CATEGORIES = [
  "Sangat Baik",
  "Baik",
  "Cukup",
  "Perlu Perbaikan",
] as const;
export type PerformanceCategory = (typeof PERFORMANCE_CATEGORIES)[number];

export type PerformanceAspect = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
};

export type PerformanceAspectInput = {
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

export type PerformanceIneligibleEmployee = {
  employeeId: string;
  employeeName: string;
  reason: string;
};

export type PerformancePeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  status: PerformancePeriodStatus;
  ineligible: PerformanceIneligibleEmployee[];
  openedAt: string;
  closedAt: string | null;
};

export type PerformanceStatusCounts = Record<PerformanceReviewStatus, number>;

export type PerformancePeriodSummary = PerformancePeriod & {
  counts: PerformanceStatusCounts;
  reviewCount: number;
  progressPercent: number;
};

export type PerformanceReviewSummary = {
  id: string;
  periodId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  reviewerEmployeeId: string | null;
  reviewerName: string | null;
  status: PerformanceReviewStatus;
  finalScore: number | null;
  finalCategory: PerformanceCategory | null;
  returnReason: string | null;
  excludedReason: string | null;
  updatedAt: string;
};

export type PerformanceReviewScore = {
  id: string;
  aspectId: string | null;
  aspectName: string;
  aspectDescription: string;
  sortOrder: number;
  score: number | null;
  note: string;
};

export type PerformanceReviewHistoryEntry = {
  id: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  actorName: string;
  actedAt: string;
};

export type PerformanceReviewDetail = PerformanceReviewSummary & {
  periodName: string;
  periodStatus: PerformancePeriodStatus;
  periodStartDate: string;
  periodEndDate: string;
  periodDueDate: string;
  achievementNotes: string;
  strengths: string;
  improvementAreas: string;
  generalNotes: string;
  scores: PerformanceReviewScore[];
  history: PerformanceReviewHistoryEntry[];
};

export type PerformancePeriodDetail = {
  period: PerformancePeriodSummary;
  reviews: PerformanceReviewSummary[];
};

export type PerformanceTeamRow = PerformanceReviewSummary & {
  periodName: string;
  periodEndDate: string;
  periodDueDate: string;
};

export type MyPerformanceResult = {
  reviewId: string;
  periodId: string;
  periodName: string;
  periodStartDate: string;
  periodEndDate: string;
  finalScore: number;
  finalCategory: PerformanceCategory;
  achievementNotes: string;
  strengths: string;
  improvementAreas: string;
  generalNotes: string;
  scores: PerformanceReviewScore[];
};

export type EmployeePerformanceHistoryEntry = {
  reviewId: string;
  periodName: string;
  periodEndDate: string;
  finalScore: number;
  finalCategory: PerformanceCategory;
};

export type PerformanceReviewFilters = {
  q: string;
  department: string;
  status: string;
  reviewer: string;
};

export type PerformanceReviewScoreInput = {
  scoreId: string;
  score: number | null;
  note: string;
};

export type PerformanceDraftInput = {
  scores: PerformanceReviewScoreInput[];
  achievementNotes: string;
  strengths: string;
  improvementAreas: string;
  generalNotes: string;
};
