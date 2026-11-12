"use client";

import { DetailDrawer } from "@/components/ui/detail-drawer";
import { CompareItem, InfoGrid, InfoItem } from "@/components/ui/detail-info";
import { FormSection } from "@/components/ui/form-section";
import { formatClockID, formatDateID, formatDateTimeID } from "@/lib/datetime";
import type {
  AttendanceCorrection,
  AttendanceEmployee,
} from "@/lib/attendance/types";

export function CorrectionHistoryDrawer({
  target,
  onClose,
}: {
  target: {
    employee: AttendanceEmployee;
    date: string;
    corrections: AttendanceCorrection[];
  } | null;
  onClose: () => void;
}) {
  return (
    <DetailDrawer
      open={Boolean(target)}
      title="Riwayat Koreksi"
      description="Jejak koreksi kehadiran yang dicatat HR."
      size="md"
      onClose={onClose}
    >
      {target && (
        <div className="flex flex-col gap-4">
          <FormSection
            icon="users"
            title="Karyawan"
            description="Karyawan dan tanggal yang dikoreksi."
          >
            <InfoGrid>
              <InfoItem label="Nama" value={target.employee.fullName} />
              <InfoItem label="Nomor karyawan" value={target.employee.id} />
              <InfoItem label="Tanggal" value={formatDateID(target.date)} />
            </InfoGrid>
          </FormSection>

          <FormSection
            icon="clock"
            title="Koreksi"
            description="Perubahan jam dan alasan koreksi."
          >
            <div className="flex flex-col gap-3">
              {target.corrections.map((correction) => (
                <div
                  className="flex flex-col gap-2 pb-3 border-b last:border-b-0"
                  style={{ borderColor: "var(--line)" }}
                  key={correction.id}
                >
                  <div className="text-[12px] font-semibold">
                    {formatDateTimeID(correction.correctedAt)}
                  </div>
                  <div className="text-[11px] sub">
                    oleh {correction.correctedByName ?? "HR"}
                  </div>
                  <div className="text-[12px] break-words">
                    “{correction.reason}”
                  </div>
                  <div className="flex flex-col gap-2">
                    <CompareItem
                      label="Jam masuk"
                      before={
                        correction.oldCheckInAt
                          ? formatClockID(correction.oldCheckInAt)
                          : "—"
                      }
                      after={
                        correction.newCheckInAt
                          ? formatClockID(correction.newCheckInAt)
                          : "—"
                      }
                      changed={
                        correction.oldCheckInAt !== correction.newCheckInAt
                      }
                    />
                    <CompareItem
                      label="Jam pulang"
                      before={
                        correction.oldCheckOutAt
                          ? formatClockID(correction.oldCheckOutAt)
                          : "—"
                      }
                      after={
                        correction.newCheckOutAt
                          ? formatClockID(correction.newCheckOutAt)
                          : "—"
                      }
                      changed={
                        correction.oldCheckOutAt !== correction.newCheckOutAt
                      }
                    />
                  </div>
                </div>
              ))}
              {target.corrections.length === 0 && (
                <div className="sub text-[13px]">
                  Belum ada koreksi untuk tanggal ini.
                </div>
              )}
            </div>
          </FormSection>
        </div>
      )}
    </DetailDrawer>
  );
}
