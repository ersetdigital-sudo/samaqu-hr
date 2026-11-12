"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { formatDateID } from "@/lib/datetime";
import { WEEKDAY_OPTIONS } from "@/lib/attendance/rules";
import type {
  AttendanceFieldErrors,
  HolidayEntry,
  HolidayInput,
  ScheduleInput,
  WorkSchedule,
} from "@/lib/attendance/types";
import {
  HOLIDAY_NAME_MAX,
  validateHolidayInput,
  validateScheduleInput,
} from "@/lib/attendance/validation";
import "@/components/recruitment-live/live.css";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
      {message}
    </div>
  );
}

const sortHolidays = (holidays: HolidayEntry[]) =>
  [...holidays].sort((a, b) =>
    a.holidayDate.localeCompare(b.holidayDate)
  );

export function ScheduleView({
  initialSchedule,
  initialHolidays,
}: {
  initialSchedule: WorkSchedule | null;
  initialHolidays: HolidayEntry[];
}) {
  const { toast } = useRecruitment();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [holidays, setHolidays] = useState(sortHolidays(initialHolidays));

  const [workDays, setWorkDays] = useState<number[]>(
    initialSchedule?.workDays ?? [1, 2, 3, 4, 5, 6]
  );
  const [startTime, setStartTime] = useState(
    initialSchedule?.startTime ?? "08:00"
  );
  const [endTime, setEndTime] = useState(
    initialSchedule?.endTime ?? "17:00"
  );
  const [breakMinutes, setBreakMinutes] = useState(
    initialSchedule?.breakMinutes ?? 60
  );
  const [lateToleranceMinutes, setLateToleranceMinutes] = useState(
    initialSchedule?.lateToleranceMinutes ?? 10
  );
  const [scheduleErrors, setScheduleErrors] = useState<AttendanceFieldErrors>(
    {}
  );
  const [scheduleError, setScheduleError] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(
    null
  );
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayErrors, setHolidayErrors] = useState<AttendanceFieldErrors>({});
  const [holidayError, setHolidayError] = useState("");
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HolidayEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!schedule) return;
    setWorkDays(schedule.workDays);
    setStartTime(schedule.startTime);
    setEndTime(schedule.endTime);
    setBreakMinutes(schedule.breakMinutes);
    setLateToleranceMinutes(schedule.lateToleranceMinutes);
  }, [schedule]);

  const toggleDay = (day: number) => {
    setWorkDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b)
    );
    setScheduleErrors((current) => ({ ...current, workDays: "" }));
    setScheduleError("");
  };

  const saveSchedule = async () => {
    const input: ScheduleInput = {
      workDays,
      startTime,
      endTime,
      breakMinutes,
      lateToleranceMinutes,
    };
    const errors = validateScheduleInput(input);
    setScheduleErrors(errors);
    if (Object.keys(errors).length > 0) {
      setScheduleError("Periksa kembali jadwal kerja.");
      return;
    }

    setSavingSchedule(true);
    setScheduleError("");
    try {
      const response = await fetch("/api/attendance/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await response.json().catch(() => null)) as {
        schedule?: WorkSchedule;
        error?: string;
        errors?: AttendanceFieldErrors;
      } | null;
      if (!response.ok || !body?.schedule) {
        if (body?.errors) setScheduleErrors(body.errors);
        throw new Error(body?.error ?? "Gagal menyimpan jadwal kerja");
      }
      setSchedule(body.schedule);
      setScheduleErrors({});
      setScheduleError("");
      toast("Jadwal kerja disimpan");
    } catch (error) {
      setScheduleError(
        error instanceof Error ? error.message : "Gagal menyimpan jadwal"
      );
    } finally {
      setSavingSchedule(false);
    }
  };

  const resetHolidayForm = () => {
    setEditingHolidayId(null);
    setHolidayDate("");
    setHolidayName("");
    setHolidayErrors({});
    setHolidayError("");
  };

  const saveHoliday = async () => {
    const input: HolidayInput = { holidayDate, name: holidayName };
    const errors = validateHolidayInput(input);
    setHolidayErrors(errors);
    if (Object.keys(errors).length > 0) {
      setHolidayError("Periksa kembali data hari libur.");
      return;
    }

    setSavingHoliday(true);
    setHolidayError("");
    try {
      const response = await fetch(
        editingHolidayId
          ? `/api/attendance/holidays/${editingHolidayId}`
          : "/api/attendance/holidays",
        {
          method: editingHolidayId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const body = (await response.json().catch(() => null)) as {
        holiday?: HolidayEntry;
        error?: string;
        errors?: AttendanceFieldErrors;
      } | null;
      if (!response.ok || !body?.holiday) {
        if (body?.errors) setHolidayErrors(body.errors);
        throw new Error(body?.error ?? "Gagal menyimpan hari libur");
      }

      setHolidays((current) => {
        const next = editingHolidayId
          ? current.map((item) =>
              item.id === body.holiday!.id ? body.holiday! : item
            )
          : [...current, body.holiday!];
        return sortHolidays(next);
      });
      toast(editingHolidayId ? "Hari libur diperbarui" : "Hari libur ditambahkan");
      resetHolidayForm();
    } catch (error) {
      setHolidayError(
        error instanceof Error ? error.message : "Gagal menyimpan hari libur"
      );
    } finally {
      setSavingHoliday(false);
    }
  };

  const startEditHoliday = (holiday: HolidayEntry) => {
    setEditingHolidayId(holiday.id);
    setHolidayDate(holiday.holidayDate);
    setHolidayName(holiday.name);
    setHolidayErrors({});
    setHolidayError("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `/api/attendance/holidays/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal menghapus hari libur");
      }
      setHolidays((current) =>
        current.filter((item) => item.id !== deleteTarget.id)
      );
      if (editingHolidayId === deleteTarget.id) resetHolidayForm();
      setDeleteTarget(null);
      toast("Hari libur dihapus");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Gagal menghapus hari libur"
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHead
        title="Shift & Jadwal Kerja"
        subtitle="Atur satu jadwal kerja aktif dan kalender libur perusahaan."
      />

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="card p-6">
          <div className="font-bold text-[16px] mb-1">Jadwal Kerja</div>
          <div className="sub text-[12px] mb-4">
            Satu jadwal berlaku untuk semua karyawan. Disimpan siap
            dikembangkan menjadi jadwal per karyawan.
          </div>

          {scheduleError && (
            <div className="tag t-bad w-full justify-center mb-3">
              {scheduleError}
            </div>
          )}

          <div className="text-[12px] font-semibold mb-2">Hari kerja</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {WEEKDAY_OPTIONS.map((day) => (
              <label
                key={day.value}
                className="flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg border cursor-pointer"
                style={{ borderColor: "var(--line)" }}
              >
                <input
                  type="checkbox"
                  checked={workDays.includes(day.value)}
                  disabled={savingSchedule}
                  onChange={() => toggleDay(day.value)}
                  style={{ accentColor: "var(--pink)" }}
                />
                {day.label}
              </label>
            ))}
          </div>
          <FieldError message={scheduleErrors.workDays} />

          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <div>
              <label className="lbl" htmlFor="schedule-start">
                Jam masuk
              </label>
              <input
                id="schedule-start"
                type="time"
                className="inp"
                value={startTime}
                disabled={savingSchedule}
                onChange={(event) => setStartTime(event.target.value)}
              />
              <FieldError message={scheduleErrors.startTime} />
            </div>
            <div>
              <label className="lbl" htmlFor="schedule-end">
                Jam pulang
              </label>
              <input
                id="schedule-end"
                type="time"
                className="inp"
                value={endTime}
                disabled={savingSchedule}
                onChange={(event) => setEndTime(event.target.value)}
              />
              <FieldError message={scheduleErrors.endTime} />
            </div>
            <div>
              <label className="lbl" htmlFor="schedule-break">
                Istirahat (menit)
              </label>
              <input
                id="schedule-break"
                type="number"
                min={0}
                max={240}
                className="inp"
                value={breakMinutes}
                disabled={savingSchedule}
                onChange={(event) =>
                  setBreakMinutes(Number(event.target.value))
                }
              />
              <FieldError message={scheduleErrors.breakMinutes} />
            </div>
            <div>
              <label className="lbl" htmlFor="schedule-tolerance">
                Toleransi terlambat (menit)
              </label>
              <input
                id="schedule-tolerance"
                type="number"
                min={0}
                max={120}
                className="inp"
                value={lateToleranceMinutes}
                disabled={savingSchedule}
                onChange={(event) =>
                  setLateToleranceMinutes(Number(event.target.value))
                }
              />
              <FieldError message={scheduleErrors.lateToleranceMinutes} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <button
              type="button"
              className="btn btn-p"
              onClick={() => void saveSchedule()}
              disabled={savingSchedule}
            >
              {savingSchedule ? "Menyimpan…" : "Simpan Jadwal"}
            </button>
            {schedule && (
              <span className="tag t-mute self-center">
                Berlaku: {schedule.name}
              </span>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="font-bold text-[16px] mb-1">Kalender Libur</div>
          <div className="sub text-[12px] mb-4">
            Hari libur tidak dihitung Alfa dan tidak bisa check-in.
          </div>

          {holidayError && (
            <div className="tag t-bad w-full justify-center mb-3">
              {holidayError}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="lbl" htmlFor="holiday-date">
                Tanggal *
              </label>
              <input
                id="holiday-date"
                type="date"
                className="inp"
                value={holidayDate}
                disabled={savingHoliday}
                onChange={(event) => setHolidayDate(event.target.value)}
              />
              <FieldError message={holidayErrors.holidayDate} />
            </div>
            <div>
              <label className="lbl" htmlFor="holiday-name">
                Nama libur *
              </label>
              <input
                id="holiday-name"
                className="inp"
                maxLength={HOLIDAY_NAME_MAX}
                placeholder="cth. Hari Kemerdekaan"
                value={holidayName}
                disabled={savingHoliday}
                onChange={(event) => setHolidayName(event.target.value)}
              />
              <FieldError message={holidayErrors.name} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              className="btn btn-p"
              onClick={() => void saveHoliday()}
              disabled={savingHoliday}
            >
              {savingHoliday
                ? "Menyimpan…"
                : editingHolidayId
                  ? "Simpan Perubahan"
                  : "Tambah Libur"}
            </button>
            {editingHolidayId && (
              <button
                type="button"
                className="btn btn-g"
                onClick={resetHolidayForm}
                disabled={savingHoliday}
              >
                Batal Edit
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-5">
            {holidays.map((holiday) => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border"
                style={{ borderColor: "var(--line)" }}
                key={holiday.id}
              >
                <div>
                  <div className="text-[13px] font-semibold">
                    {formatDateID(holiday.holidayDate)}
                  </div>
                  <div className="text-[11px] sub">{holiday.name}</div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="btn btn-g !py-1 !px-2 !text-[11px]"
                    onClick={() => startEditHoliday(holiday)}
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    className="btn btn-g !py-1 !px-2 !text-[11px]"
                    style={{ color: "var(--bad)" }}
                    onClick={() => setDeleteTarget(holiday)}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
            {holidays.length === 0 && (
              <div className="sub text-[13px]">
                Belum ada hari libur. Tambahkan tanggal libur pertama.
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="rl">
          <ConfirmDialog
            title="Hapus hari libur?"
            description={`Hari libur "${deleteTarget.name}" pada ${formatDateID(
              deleteTarget.holidayDate
            )} akan dihapus. Tindakan ini tidak bisa dibatalkan.`}
            confirmLabel="Ya, hapus"
            danger
            busy={deleting}
            onClose={() => setDeleteTarget(null)}
            onConfirm={() => void confirmDelete()}
          />
        </div>
      )}
    </>
  );
}
