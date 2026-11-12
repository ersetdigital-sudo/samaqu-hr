"use client";

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
    <div className={`drawer ${target ? "show" : ""}`}>
      {target && (
        <>
          <div
            className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="font-bold">Riwayat Koreksi</span>
            <button
              className="btn btn-g !px-3"
              onClick={onClose}
              aria-label="Tutup riwayat koreksi"
            >
              ✕
            </button>
          </div>

          <div className="p-6">
            <div className="font-bold text-[16px]">
              {target.employee.fullName}
            </div>
            <div className="sub text-[12px]">
              {target.employee.id} · {formatDateID(target.date)}
            </div>

            <div className="flex flex-col gap-4 mt-5">
              {target.corrections.map((correction) => (
                <div
                  className="p-3 rounded-xl border"
                  style={{ borderColor: "var(--line)" }}
                  key={correction.id}
                >
                  <div className="text-[12px] font-semibold">
                    {formatDateTimeID(correction.correctedAt)}
                  </div>
                  <div className="text-[11px] sub">
                    oleh {correction.correctedByName ?? "HR"}
                  </div>
                  <div className="text-[12px] mt-2">“{correction.reason}”</div>
                  <div className="text-[11px] sub mt-2">
                    Masuk:{" "}
                    {correction.oldCheckInAt
                      ? formatClockID(correction.oldCheckInAt)
                      : "—"}{" "}
                    →{" "}
                    {correction.newCheckInAt
                      ? formatClockID(correction.newCheckInAt)
                      : "—"}
                    <br />
                    Pulang:{" "}
                    {correction.oldCheckOutAt
                      ? formatClockID(correction.oldCheckOutAt)
                      : "—"}{" "}
                    →{" "}
                    {correction.newCheckOutAt
                      ? formatClockID(correction.newCheckOutAt)
                      : "—"}
                  </div>
                </div>
              ))}
              {target.corrections.length === 0 && (
                <div className="sub text-[13px]">
                  Belum ada koreksi untuk tanggal ini.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
