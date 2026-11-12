"use client";

import { PositionHistoryDetail } from "@/components/position-history/position-history-detail";
import { DrawerHeader } from "@/components/ui/drawer-header";
import { DRAWER_SIZE_CLASS } from "@/components/ui/drawer-sizes";
import { ini } from "@/lib/data";
import type { PositionHistoryEntry } from "@/lib/position-history/types";

export function PositionHistoryDrawer({
  entry,
  onClose,
}: {
  entry: PositionHistoryEntry | null;
  onClose: () => void;
}) {
  return (
    <div
      className={`drawer ${DRAWER_SIZE_CLASS.sm} ${entry ? "show" : ""}`}
    >
      {entry && (
        <>
          <DrawerHeader
            title="Detail Perubahan"
            onClose={onClose}
            closeLabel="Tutup detail perubahan"
          />

          <div className="p-6">
            <div className="flex items-center gap-4 mb-5">
              <div
                className="av"
                style={{ width: 56, height: 56, fontSize: 18 }}
              >
                {ini(entry.employeeName)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-[19px] leading-tight break-words">
                  {entry.employeeName}
                </div>
                <div className="sub text-[13px]">{entry.employeeId}</div>
              </div>
            </div>

            <PositionHistoryDetail entry={entry} />
          </div>
        </>
      )}
    </div>
  );
}
