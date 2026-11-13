"use client";

import { useEffect, useMemo, useState } from "react";
import { MonthNavigation } from "@/components/attendance/month-navigation";
import { LeaveStatusTag } from "@/components/leave/leave-status-tag";
import { formatDateID } from "@/lib/datetime";
import { datesInMonth, isoWeekday, shiftMonth } from "@/lib/attendance/rules";
import type { LeaveCalendarData } from "@/lib/leave/types";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function LeaveCalendar({
  initialMonth,
  todayIso,
}: {
  initialMonth: string;
  todayIso: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<LeaveCalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/leave/calendar?month=${encodeURIComponent(month)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = (await response
          .json()
          .catch(() => null)) as (LeaveCalendarData & { error?: string }) | null;
        if (!response.ok || !body) {
          throw new Error(body?.error ?? "Gagal memuat kalender cuti");
        }
        return body;
      })
      .then((body) => {
        if (active) setData(body);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Gagal memuat kalender cuti"
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [month]);

  const cells = useMemo(() => {
    const days = datesInMonth(month);
    const first = isoWeekday(`${month}-01`);
    const list: (string | null)[] = Array.from({ length: first - 1 }, () => null);
    list.push(...days);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [month]);

  const leaveOn = (date: string) =>
    (data?.entries ?? []).filter(
      (entry) => entry.startDate <= date && entry.endDate >= date
    );

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="font-bold">Kalender Cuti</div>
          <div className="text-[11px] sub">
            Siapa yang cuti pada tanggal berapa. Menunggu dan Disetujui
            ditampilkan.
          </div>
        </div>
        <MonthNavigation
          month={month}
          disableNext={false}
          onChange={(delta) => setMonth((current) => shiftMonth(current, delta))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3 text-[11px] sub">
        <span className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: "var(--pink)" }}
          />
          Disetujui
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: "#C9A227" }}
          />
          Menunggu
        </span>
        {loading && <span role="status">Memuat kalender…</span>}
      </div>

      {error && (
        <div className="tag t-bad w-full justify-center mb-3">{error}</div>
      )}

      <div className="overflow-x-auto">
        <div style={{ minWidth: 760 }}>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-[11px] font-semibold sub py-1"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, index) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="rounded-lg"
                    style={{ minHeight: 86, background: "transparent" }}
                  />
                );
              }

              const entries = leaveOn(date);
              const isToday = date === todayIso;
              return (
                <div
                  key={date}
                  className="rounded-lg border p-1.5"
                  style={{
                    minHeight: 86,
                    borderColor: isToday ? "var(--pink)" : "var(--line)",
                    background: isToday ? "#FFF7FA" : "#fff",
                  }}
                >
                  <div
                    className={`text-[11px] font-semibold mb-1 ${
                      isToday ? "" : "sub"
                    }`}
                  >
                    {Number(date.slice(8, 10))}
                  </div>
                  {entries.slice(0, 2).map((entry) => (
                    <div
                      key={entry.id}
                      className="text-[10px] leading-tight rounded px-1 py-0.5 mb-0.5 truncate"
                      style={{ background: "#FAF7F5" }}
                      title={`${entry.employeeName} · ${entry.leaveTypeName} (${entry.status})`}
                    >
                      {entry.employeeName}
                    </div>
                  ))}
                  {entries.length > 2 && (
                    <div className="text-[10px] sub">
                      +{entries.length - 2} lagi
                    </div>
                  )}
                  {entries.length === 0 && (
                    <div className="text-[10px] sub"> </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[12px] font-semibold mb-2">
          Daftar cuti bulan ini
        </div>
        {data && data.entries.length === 0 && (
          <div className="text-[12px] sub">
            Belum ada cuti pada bulan ini.
          </div>
        )}
        <div className="flex flex-col gap-2">
          {(data?.entries ?? []).map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl"
              style={{ background: "#FAF7F5" }}
            >
              <div className="min-w-0">
                <div className="text-[12px] font-semibold break-words">
                  {entry.employeeName}
                </div>
                <div className="text-[11px] sub">
                  {entry.leaveTypeName} · {formatDateID(entry.startDate)}–
                  {formatDateID(entry.endDate)} · {entry.daysCount} hari ·{" "}
                  {entry.employeeDepartment}
                </div>
              </div>
              <LeaveStatusTag status={entry.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
