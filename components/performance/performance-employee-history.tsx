"use client";

import { useEffect, useState } from "react";
import { PerformanceCategoryTag } from "@/components/performance/performance-tags";
import { formatDateID } from "@/lib/datetime";
import {
  formatPerformanceScore,
  trendLabel,
} from "@/lib/performance/rules";
import type { EmployeePerformanceHistoryEntry } from "@/lib/performance/types";

export function PerformanceEmployeeHistory({
  employeeId,
}: {
  employeeId: string;
}) {
  const [history, setHistory] = useState<EmployeePerformanceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetch(`/api/performance/employees/${encodeURIComponent(employeeId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          history?: EmployeePerformanceHistoryEntry[];
          error?: string;
        } | null;
        if (!response.ok || !body?.history) {
          throw new Error(body?.error ?? "Gagal memuat riwayat performa");
        }
        if (active) setHistory(body.history);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Gagal memuat riwayat performa"
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [employeeId]);

  if (loading) {
    return <div className="sub text-[12px]">Memuat riwayat performa…</div>;
  }
  if (error) {
    return <div className="tag t-bad w-full justify-center">{error}</div>;
  }
  if (history.length === 0) {
    return (
      <div className="sub text-[12px]">
        Belum ada penilaian Final untuk karyawan ini.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {history.map((entry, index) => {
        const previous = history[index + 1]?.finalScore ?? null;
        return (
          <div
            className="flex flex-wrap items-center justify-between gap-2 text-[12px]"
            key={entry.reviewId}
          >
            <div>
              <div className="font-semibold">{entry.periodName}</div>
              <div className="text-[11px] sub">
                Berakhir {formatDateID(entry.periodEndDate)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] sub">{trendLabel(entry.finalScore, previous)}</span>
              <b>{formatPerformanceScore(entry.finalScore)}</b>
              <PerformanceCategoryTag category={entry.finalCategory} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
