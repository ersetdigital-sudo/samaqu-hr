"use client";

import { formatDateID } from "@/lib/datetime";
import type { MyRecapData } from "@/lib/recap/types";

export function MyRecapCard({
  data,
  loading,
}: {
  data: MyRecapData | null;
  loading: boolean;
}) {
  if (loading && !data) {
    return (
      <div className="card p-5 sm:p-6 mb-6">
        <div className="font-bold">Rekap Bulan Berjalan</div>
        <div className="sub text-[12px] mt-1" role="status">
          Memuat ringkasan kehadiran…
        </div>
      </div>
    );
  }

  if (!data?.row) return null;

  const row = data.row;

  return (
    <div className="card p-5 sm:p-6 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="font-bold">Rekap Bulan Berjalan</div>
          <div className="text-[11px] sub">
            {formatDateID(data.period.from)} –{" "}
            {formatDateID(data.period.to)} · dihitung dari kehadiran dan cuti
            yang disetujui
          </div>
        </div>
        <span
          className={`tag ${
            row.attendancePercent >= 90
              ? "t-ok"
              : row.attendancePercent >= 75
                ? "t-warn"
                : "t-bad"
          }`}
        >
          Kehadiran {row.attendancePercent}%
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: "Hadir", value: row.present },
          { label: "Terlambat", value: row.lateCount },
          { label: "Alfa", value: row.alfa },
          { label: "Cuti", value: row.cuti },
          { label: "Sakit", value: row.sakit },
          { label: "Izin", value: row.izin },
        ].map((item) => (
          <div
            key={item.label}
            className="p-3 rounded-xl"
            style={{ background: "#FAF7F5" }}
          >
            <div className="text-[11px] sub">{item.label}</div>
            <div className="text-[22px] font-bold leading-tight">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {row.workdays === 0 && (
        <div className="text-[11px] sub mt-3">
          Belum ada hari kerja yang bisa dihitung pada periode ini.
        </div>
      )}
    </div>
  );
}
