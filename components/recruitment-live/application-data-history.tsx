"use client";

import { useEffect, useState } from "react";
import { formatDateTimeID } from "@/lib/datetime";
import { CONTACT_LABELS } from "@/lib/recruitment/live/contact";
import type { ApplicationDataHistoryEntry } from "@/lib/recruitment/live/types";

/** Riwayat perubahan nama/WhatsApp/email/kota; ikut segar saat data berubah. */
export function ApplicationDataHistory({
  applicationId,
  version,
}: {
  applicationId: string;
  version: string;
}) {
  const [entries, setEntries] = useState<ApplicationDataHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/recruitment/applications/${applicationId}/data-history`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as {
          history?: ApplicationDataHistoryEntry[];
          error?: string;
        } | null;
        if (!response.ok || !data?.history)
          throw new Error(
            data?.error ?? "Riwayat perubahan data belum dapat dimuat"
          );
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
              : "Riwayat perubahan data belum dapat dimuat"
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applicationId, version, reloadKey]);

  return (
    <div className="flex flex-col gap-2">
      <div className="font-bold text-[13px]">Riwayat Perubahan Data</div>

      {loading && (
        <p className="sub text-[12px]" role="status">
          Memuat riwayat data…
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
        <p className="sub text-[12px]">Belum ada perubahan data.</p>
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
                  {CONTACT_LABELS[entry.column] ?? entry.column}
                </div>
                <div className="text-[12px] sub break-words">
                  {entry.oldValue || "—"} → {entry.newValue || "—"}
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
