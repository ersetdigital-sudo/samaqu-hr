/** Tipe dan perhitungan murni laporan rekrutmen (dipakai server & UI). */

export type ReportPeriod = "30" | "90" | "365" | "all";

export const PERIOD_OPTIONS: {
  value: ReportPeriod;
  label: string;
  days: number | null;
}[] = [
  { value: "30", label: "30 hari terakhir", days: 30 },
  { value: "90", label: "90 hari terakhir", days: 90 },
  { value: "365", label: "12 bulan terakhir", days: 365 },
  { value: "all", label: "Semua", days: null },
];

export const isReportPeriod = (value: unknown): value is ReportPeriod =>
  value === "30" || value === "90" || value === "365" || value === "all";

export const periodLabel = (value: ReportPeriod): string =>
  PERIOD_OPTIONS.find((option) => option.value === value)?.label ?? "30 hari terakhir";

export const MIN_SAMPLE = 3;

export type ReportSummaryCounts = {
  total: number;
  inProgress: number;
  accepted: number;
  rejected: number;
};

export type ReportData = {
  summary: ReportSummaryCounts & { previous: ReportSummaryCounts | null };
  funnel: { stage: string; count: number }[];
  speed: {
    toAccepted: { avgDays: number | null; sample: number };
    stages: { stage: string; avgDays: number | null; sample: number }[];
  };
  perJob: {
    jobId: string;
    title: string;
    total: number;
    inProgress: number;
    accepted: number;
    rejected: number;
  }[];
  trend: { weekStart: string; count: number }[];
  sources: { source: string; count: number }[];
  interviews: {
    total: number;
    selesai: number;
    tidakHadir: number;
    dibatalkan: number;
    avgScore: number | null;
    recommendations: {
      lanjut: number;
      pertimbangkan: number;
      tolak: number;
    };
  };
  jobs: { id: string; title: string }[];
};

export const sourceLabel = (source: string): string =>
  source || "Tidak diisi";

/** Persen perubahan; null bila tidak ada pembanding (pembagi nol). */
export function percentChange(
  current: number,
  previous: number
): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Persen aman; null bila pembagi nol. */
export function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

export const passRate = (from: number, to: number): number | null =>
  rate(to, from);

export const acceptanceRate = (accepted: number, total: number): number | null =>
  rate(accepted, total);

export function formatPercent(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: digits,
  }).format(value)}%`;
}

export function formatDays(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
  }).format(value)} hari`;
}

export function formatScore(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(value);
}