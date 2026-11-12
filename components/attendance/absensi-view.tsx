"use client";

import { useCallback, useMemo, useState } from "react";
import { AttendanceStatusTag } from "@/components/attendance/attendance-status-tag";
import { MonthNavigation } from "@/components/attendance/month-navigation";
import { useServerClock } from "@/components/attendance/use-server-clock";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  formatClockID,
  formatClockSecondsID,
  formatLongDateID,
  formatWeekdayDateID,
} from "@/lib/datetime";
import {
  buildAttendanceMonthDays,
  computeAttendanceDay,
  formatDurationMinutes,
  shiftMonth,
  workDaysLabel,
} from "@/lib/attendance/rules";
import type { AttendanceMonthData } from "@/lib/attendance/types";

type AttendanceResponse = AttendanceMonthData & { error?: string };

export function AbsensiView({
  initialData,
  initialMonth,
}: {
  initialData: AttendanceMonthData;
  initialMonth: string;
}) {
  const { toast } = useRecruitment();
  const [data, setData] = useState(initialData);
  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"check-in" | "check-out" | null>(null);
  const clock = useServerClock(data.serverNow);

  const employee = data.employee;
  const todayIso = data.todayIso;
  const currentMonth = todayIso.slice(0, 7);

  const todayHoliday = data.holidays.find(
    (holiday) => holiday.holidayDate === todayIso
  );

  const todayDay = useMemo(() => {
    if (!employee) return null;
    return computeAttendanceDay({
      date: todayIso,
      todayIso,
      schedule: data.schedule,
      holidayName: todayHoliday?.name ?? null,
      record: data.todayRecord,
      joinedAt: employee.joinedAt,
    });
  }, [employee, todayIso, data.schedule, data.todayRecord, todayHoliday?.name]);

  const monthDays = useMemo(() => {
    const days = buildAttendanceMonthDays({
      monthKey: month,
      todayIso,
      schedule: data.schedule,
      holidays: data.holidays,
      records: data.monthRecords,
      joinedAt: employee?.joinedAt ?? null,
    });

    return days
      .filter(
        (day) => day.date <= todayIso && day.dayType !== "before-employment"
      )
      .reverse();
  }, [month, todayIso, data.schedule, data.holidays, data.monthRecords, employee?.joinedAt]);

  const loadMonth = useCallback(
    async (nextMonth: string) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/attendance/me?month=${encodeURIComponent(nextMonth)}`,
          { cache: "no-store" }
        );
        const body = (await response
          .json()
          .catch(() => null)) as AttendanceResponse | null;
        if (!response.ok || !body) {
          throw new Error(body?.error ?? "Gagal memuat kehadiran");
        }
        setData(body);
        setMonth(nextMonth);
      } catch (error) {
        toast(
          error instanceof Error
            ? error.message
            : "Gagal memuat kehadiran"
        );
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const changeMonth = (delta: number) => {
    const next = shiftMonth(month, delta);
    if (next > currentMonth) return;
    void loadMonth(next);
  };

  const runAction = async (kind: "check-in" | "check-out") => {
    setAction(kind);
    try {
      const response = await fetch(`/api/attendance/${kind}`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(
          body?.error ??
            (kind === "check-in"
              ? "Check-in gagal"
              : "Check-out gagal")
        );
      }
      await loadMonth(month);
      toast(
        kind === "check-in" ? "Check-in berhasil" : "Check-out berhasil"
      );
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan absensi"
      );
    } finally {
      setAction(null);
    }
  };

  const activeEmployee =
    employee?.status === "Aktif" || employee?.status === "Probation";
  const canCheckIn =
    Boolean(activeEmployee && data.schedule && todayDay?.dayType === "workday") &&
    !data.todayRecord?.checkInAt;
  const canCheckOut =
    Boolean(activeEmployee && data.schedule && todayDay?.dayType === "workday") &&
    Boolean(data.todayRecord?.checkInAt) &&
    !data.todayRecord?.checkOutAt;

  const disabledReason = (() => {
    if (!employee) return "Data karyawan belum tersedia.";
    if (!activeEmployee) {
      return "Status karyawan Nonaktif. Hubungi HR untuk reaktivasi.";
    }
    if (!data.schedule) return "Jadwal kerja belum diatur oleh HR.";
    if (todayDay?.dayType === "before-employment") {
      return "Belum memasuki masa kerja.";
    }
    if (todayDay?.dayType === "holiday") {
      return `Hari ini libur${todayDay.holidayName ? `: ${todayDay.holidayName}` : ""}.`;
    }
    if (todayDay?.dayType === "offday") {
      return "Hari ini bukan hari kerja.";
    }
    if (data.todayRecord?.checkInAt && data.todayRecord.checkOutAt) {
      return "Absensi hari ini sudah lengkap.";
    }
    return null;
  })();

  return (
    <>
      <PageHead
        title="Absensi"
        subtitle="Check-in dan check-out harian. Waktu mengikuti server dalam zona Asia/Jakarta."
      >
        <button
          type="button"
          className="btn btn-g"
          onClick={() => void loadMonth(month)}
          disabled={loading}
        >
          {loading ? "Memuat…" : "Muat ulang"}
        </button>
      </PageHead>

      {!data.linked || !employee ? (
        <div className="card p-8 text-center max-w-[640px]">
          <div className="font-semibold text-[15px]">Akun belum tertaut</div>
          <div className="sub text-[13px] mt-2">
            Akun kamu belum tertaut ke data karyawan, sehingga absensi belum
            bisa digunakan. Hubungi admin HR untuk menautkan akunmu.
          </div>
        </div>
      ) : (
        <>
          <div className="card p-6 mb-6" aria-busy={loading}>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
              <div>
                <div
                  className="text-[42px] sm:text-[56px] font-extrabold tracking-tight leading-none"
                  style={{ color: "var(--ink)" }}
                >
                  {formatClockSecondsID(clock)}
                </div>
                <div className="sub text-[13px] mt-2">
                  {formatLongDateID(clock)} · WIB
                </div>
                <div className="sub text-[12px] mt-1">
                  {employee.fullName} · {employee.id}
                </div>
              </div>

              <div className="lg:text-right">
                {todayDay && <AttendanceStatusTag day={todayDay} />}
                <div className="text-[11px] sub mt-2">
                  Masuk:{" "}
                  {data.todayRecord?.checkInAt
                    ? formatClockID(data.todayRecord.checkInAt)
                    : "—"}{" "}
                  · Pulang:{" "}
                  {data.todayRecord?.checkOutAt
                    ? formatClockID(data.todayRecord.checkOutAt)
                    : "—"}
                </div>
                {todayDay?.durationMinutes !== null &&
                  todayDay?.durationMinutes !== undefined && (
                    <div className="text-[11px] sub mt-1">
                      Durasi: {formatDurationMinutes(todayDay.durationMinutes)}
                    </div>
                  )}
              </div>
            </div>

            <div
              className="mt-5 p-3 rounded-xl text-[12px]"
              style={{ background: "#FAF7F5" }}
            >
              <div className="font-semibold">Jadwal hari ini</div>
              {data.schedule ? (
                <div className="sub mt-1">
                  {workDaysLabel(data.schedule.workDays)} ·{" "}
                  {data.schedule.startTime}–{data.schedule.endTime} · istirahat{" "}
                  {data.schedule.breakMinutes} menit · toleransi{" "}
                  {data.schedule.lateToleranceMinutes} menit
                </div>
              ) : (
                <div className="sub mt-1">Jadwal kerja belum diatur.</div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-5">
              {!data.todayRecord?.checkInAt && (
                <button
                  type="button"
                  className="btn btn-p w-full sm:w-auto"
                  disabled={!canCheckIn || action !== null || loading}
                  onClick={() => void runAction("check-in")}
                >
                  {action === "check-in" ? "Memproses…" : "Check-in"}
                </button>
              )}
              {data.todayRecord?.checkInAt && !data.todayRecord?.checkOutAt && (
                <button
                  type="button"
                  className="btn btn-p w-full sm:w-auto"
                  disabled={!canCheckOut || action !== null || loading}
                  onClick={() => void runAction("check-out")}
                >
                  {action === "check-out" ? "Memproses…" : "Check-out"}
                </button>
              )}
              {data.todayRecord?.checkInAt && data.todayRecord?.checkOutAt && (
                <span className="tag t-ok w-full sm:w-auto justify-center">
                  Absensi hari ini selesai
                </span>
              )}
            </div>

            {disabledReason && (
              <div className="text-[12px] sub mt-2">{disabledReason}</div>
            )}
          </div>

          <div className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="font-bold">Riwayat Kehadiran</div>
                <div className="text-[11px] sub">
                  Hari libur dan hari non-kerja ditandai.
                </div>
              </div>
              <MonthNavigation
                month={month}
                disableNext={month >= currentMonth || loading}
                onChange={changeMonth}
              />
            </div>

            {loading && (
              <div className="sub text-[12px] mb-2" role="status">
                Memuat bulan…
              </div>
            )}

            <div className="flex flex-col gap-2">
              {monthDays.map((day) => (
                <div
                  key={day.date}
                  className="p-3 rounded-xl border"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-semibold">
                        {formatWeekdayDateID(day.date)}
                      </div>
                      <div className="text-[11px] sub">
                        Masuk:{" "}
                        {day.record?.checkInAt
                          ? formatClockID(day.record.checkInAt)
                          : "—"}{" "}
                        · Pulang:{" "}
                        {day.record?.checkOutAt
                          ? formatClockID(day.record.checkOutAt)
                          : "—"}{" "}
                        · {formatDurationMinutes(day.durationMinutes)}
                      </div>
                    </div>
                    <AttendanceStatusTag day={day} />
                  </div>
                </div>
              ))}
              {monthDays.length === 0 && (
                <div className="text-center py-5">
                  <div className="font-semibold text-[13px]">
                    Belum ada riwayat
                  </div>
                  <div className="sub text-[12px] mt-1">
                    Tidak ada hari kerja pada bulan ini.
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
