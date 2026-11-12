"use client";

import { PositionHistoryDetail } from "@/components/position-history/position-history-detail";
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
    <div className={`drawer ${entry ? "show" : ""}`}>
      {entry && (
        <>
          <div
            className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="font-bold">Detail Perubahan</span>
            <button
              className="btn btn-g !px-3"
              onClick={onClose}
              aria-label="Tutup detail perubahan"
            >
              ✕
            </button>
          </div>

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
