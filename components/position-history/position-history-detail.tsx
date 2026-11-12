import { formatDateID, formatDateTimeID } from "@/lib/datetime";
import { positionChangeTone } from "@/lib/position-history/query";
import {
  POSITION_FIELD_LABELS,
  positionChangeDiff,
} from "@/lib/position-history/rules";
import type { PositionHistoryEntry } from "@/lib/position-history/types";

export function PositionHistoryDetail({
  entry,
}: {
  entry: PositionHistoryEntry;
}) {
  const managerName = (id: string | null) => {
    if (!id) return "—";
    if (id === entry.oldManagerId) return entry.oldManagerName ?? id;
    if (id === entry.newManagerId) return entry.newManagerName ?? id;
    return id;
  };

  const diffs = positionChangeDiff(entry, managerName);
  const changed = new Set(diffs.map((diff) => diff.field));

  const rows = [
    {
      field: "position" as const,
      before: entry.oldPosition,
      after: entry.newPosition,
    },
    {
      field: "department" as const,
      before: entry.oldDepartment,
      after: entry.newDepartment,
    },
    {
      field: "manager" as const,
      before: entry.oldManagerName ?? "—",
      after: entry.newManagerName ?? "—",
    },
    {
      field: "location" as const,
      before: entry.oldLocation,
      after: entry.newLocation,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`tag ${positionChangeTone(entry.changeType)}`}>
          {entry.changeType}
        </span>
        <span className="text-[12px] sub">
          Berlaku {formatDateID(entry.effectiveDate)}
        </span>
      </div>

      <div className="flex flex-col gap-2 mt-4">
        {rows.map((row) => (
          <div
            className="p-3 rounded-xl"
            style={{ background: "#FAF7F5" }}
            key={row.field}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] sub">
                {POSITION_FIELD_LABELS[row.field]}
              </span>
              {!changed.has(row.field) && (
                <span className="text-[10px] sub">Tidak berubah</span>
              )}
            </div>
            <div className="text-[13px] mt-0.5 break-words">
              {changed.has(row.field) ? (
                <>
                  <span className="sub">{row.before}</span> →{" "}
                  <b>{row.after}</b>
                </>
              ) : (
                row.before
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="text-[11px] sub">Alasan</div>
        <div className="text-[13px] mt-1 break-words">{entry.reason}</div>
      </div>

      <div className="text-[11px] sub mt-4">
        Dicatat {formatDateTimeID(entry.recordedAt)} ·{" "}
        {entry.recordedByName ?? "HR"}
      </div>
    </>
  );
}
