"use client";

import { useEffect, useState } from "react";
import { formatDateTimeID } from "@/lib/datetime";
import type { StageHistoryEntry } from "@/lib/recruitment/live/types";

/** Timeline perubahan tahap; dimuat per pelamar dan ikut segar saat tahap berubah. */
export function StageHistory({
  applicationId,
  stage,
}: {
  applicationId: string;
  stage: string;
}) {
  const [entries, setEntries] = useState<StageHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/recruitment/applications/${applicationId}/history`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as {
          history?: StageHistoryEntry[];
          error?: string;
        } | null;
        if (!response.ok || !data?.history)
          throw new Error(data?.error ?? "Riwayat tahap belum dapat dimuat");
        return data.history;
      })
      .then((history) => {
        if (active) setEntries(history);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Riwayat tahap belum dapat dimuat",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applicationId, stage, reloadKey]);

  return (
    <div className="flex flex-col gap-2">
      <div className="font-bold text-[13px]">Riwayat Tahap</div>

      {loading && (
        <p className="sub text-[12px]" role="status">
          Memuat riwayat tahap…
        </p>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 text-[12px] flex-wrap">
          <span style={{ color: "var(--bad)" }}>{error}</span>
          <button
            type="button"
            className="btn btn-g !py-1 !px-2 !text-[11px]"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Coba lagi
          </button>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="sub text-[12px]">Belum ada riwayat tahap.</p>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex gap-3">
              <div
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{ background: "var(--pink)" }}
              />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">
                  {entry.fromStage
                    ? `${entry.fromStage} → ${entry.toStage}`
                    : entry.toStage}
                </div>
                <div className="text-[11px] sub">
                  {formatDateTimeID(entry.changedAt)} · {entry.changedByName}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
