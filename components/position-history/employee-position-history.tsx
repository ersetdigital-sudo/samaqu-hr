"use client";

import { useEffect, useState } from "react";
import { PositionHistoryTimeline } from "@/components/position-history/position-history-timeline";
import type { PositionHistoryEntry } from "@/lib/position-history/types";

export function EmployeePositionHistory({
  employeeId,
  refreshKey,
}: {
  employeeId: string;
  refreshKey: number;
}) {
  const [history, setHistory] = useState<PositionHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setHistory(null);
    setError(null);

    fetch(`/api/position-history/employee/${employeeId}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          history?: PositionHistoryEntry[];
          error?: string;
        } | null;
        if (!response.ok || !body?.history) {
          throw new Error(body?.error ?? "Gagal memuat riwayat jabatan");
        }
        return body.history;
      })
      .then((entries) => {
        if (active) setHistory(entries);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Gagal memuat riwayat jabatan"
          );
      });

    return () => {
      active = false;
    };
  }, [employeeId, refreshKey]);

  if (error) {
    return <div className="tag t-bad w-full justify-center">{error}</div>;
  }

  if (history === null) {
    return <div className="sub text-[13px]">Memuat riwayat jabatan…</div>;
  }

  return <PositionHistoryTimeline entries={history} />;
}
