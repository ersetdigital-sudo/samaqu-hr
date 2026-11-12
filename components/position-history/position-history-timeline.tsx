import { formatDateID, formatDateTimeID } from "@/lib/datetime";
import { positionChangeTone } from "@/lib/position-history/query";
import { positionChangeDiff } from "@/lib/position-history/rules";
import type { PositionHistoryEntry } from "@/lib/position-history/types";

const managerNameResolver =
  (entry: PositionHistoryEntry) => (id: string | null) => {
    if (!id) return "—";
    if (id === entry.oldManagerId) return entry.oldManagerName ?? id;
    if (id === entry.newManagerId) return entry.newManagerName ?? id;
    return id;
  };

export function PositionHistoryTimeline({
  entries,
}: {
  entries: PositionHistoryEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className="sub text-[13px]">Belum ada riwayat jabatan.</div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry) => {
        const diffs = positionChangeDiff(entry, managerNameResolver(entry));

        return (
          <div className="flex gap-3" key={entry.id}>
            <div
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ background: "var(--pink)" }}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`tag ${positionChangeTone(entry.changeType)}`}>
                  {entry.changeType}
                </span>
                <span className="text-[13px] font-semibold">
                  Efektif {formatDateID(entry.effectiveDate)}
                </span>
              </div>
              <div className="text-[11px] sub mt-0.5">
                {formatDateTimeID(entry.recordedAt)} ·{" "}
                {entry.recordedByName ?? "Dicatat HR"}
              </div>
              <div className="text-[12px] mt-1 break-words">{entry.reason}</div>
              {diffs.length > 0 && (
                <div className="flex flex-col gap-0.5 mt-1">
                  {diffs.map((diff) => (
                    <div
                      className="text-[11px] sub break-words"
                      key={diff.field}
                    >
                      <b className="font-semibold" style={{ color: "var(--ink)" }}>
                        {diff.label}:
                      </b>{" "}
                      {diff.before} → {diff.after}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
