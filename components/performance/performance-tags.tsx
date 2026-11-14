"use client";

import {
  performanceStatusTone,
  periodStatusTone,
} from "@/lib/performance/rules";
import type {
  PerformanceCategory,
  PerformanceReviewStatus,
} from "@/lib/performance/types";

export function PerformanceStatusTag({
  status,
}: {
  status: PerformanceReviewStatus;
}) {
  return (
    <span className={`tag ${performanceStatusTone(status)}`}>{status}</span>
  );
}

export function PerformancePeriodStatusTag({ status }: { status: string }) {
  return <span className={`tag ${periodStatusTone(status)}`}>{status}</span>;
}

export function PerformanceCategoryTag({
  category,
}: {
  category: PerformanceCategory;
}) {
  const tone =
    category === "Sangat Baik"
      ? "t-ok"
      : category === "Baik"
        ? "t-info"
        : category === "Cukup"
          ? "t-warn"
          : "t-bad";
  return <span className={`tag ${tone}`}>{category}</span>;
}
