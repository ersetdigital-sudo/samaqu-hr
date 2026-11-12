"use client";

import { PositionHistoryDetail } from "@/components/position-history/position-history-detail";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { FormSection } from "@/components/ui/form-section";
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
    <DetailDrawer
      open={Boolean(entry)}
      title="Detail Perubahan"
      description="Ringkasan perubahan posisi karyawan."
      size="sm"
      onClose={onClose}
    >
      {entry && (
        <div className="flex flex-col gap-4">
          <FormSection
            icon="users"
            title="Karyawan"
            description="Karyawan yang mengalami perubahan."
          >
            <div className="flex items-center gap-4">
              <div
                className="av"
                style={{ width: 56, height: 56, fontSize: 18 }}
              >
                {ini(entry.employeeName)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-[17px] leading-tight break-words">
                  {entry.employeeName}
                </div>
                <div className="sub text-[12px]">{entry.employeeId}</div>
              </div>
            </div>
          </FormSection>

          <FormSection
            icon="clock"
            title="Perubahan"
            description="Nilai sebelum dan sesudah perubahan."
          >
            <PositionHistoryDetail entry={entry} />
          </FormSection>
        </div>
      )}
    </DetailDrawer>
  );
}
