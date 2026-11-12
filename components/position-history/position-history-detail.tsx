"use client";

import { CompareItem, InfoGrid, InfoItem } from "@/components/ui/detail-info";
import { formatDateID, formatDateTimeID } from "@/lib/datetime";
import { positionChangeTone } from "@/lib/position-history/query";
import { POSITION_FIELD_LABELS } from "@/lib/position-history/rules";
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
      before: managerName(entry.oldManagerId),
      after: managerName(entry.newManagerId),
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
          <CompareItem
            key={row.field}
            label={POSITION_FIELD_LABELS[row.field]}
            before={row.before}
            after={row.after}
            changed={row.before !== row.after}
          />
        ))}
      </div>

      <div className="mt-4">
        <InfoGrid single>
          <InfoItem label="Alasan" value={entry.reason} />
          <InfoItem
            label="Dicatat"
            value={`${formatDateTimeID(entry.recordedAt)} · ${
              entry.recordedByName ?? "HR"
            }`}
          />
        </InfoGrid>
      </div>
    </>
  );
}
