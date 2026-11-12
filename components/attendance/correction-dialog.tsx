"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorBox, Modal } from "@/components/recruitment-live/ui";
import { formatClockID, formatDateID } from "@/lib/datetime";
import {
  attendanceDayLabel,
  computeAttendanceDay,
} from "@/lib/attendance/rules";
import type {
  AttendanceDay,
  AttendanceEmployee,
  AttendanceFieldErrors,
  AttendanceRecord,
  WorkSchedule,
} from "@/lib/attendance/types";
import {
  CORRECTION_REASON_MAX,
  validateCorrectionInput,
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

export function CorrectionDialog({
  open,
  employee,
  date,
  record,
  beforeDay,
  schedule,
  holidayName,
  todayIso,
  onClose,
  onSaved,
}: {
  open: boolean;
  employee: AttendanceEmployee | null;
  date: string;
  record: AttendanceRecord | null;
  beforeDay: AttendanceDay | null;
  schedule: WorkSchedule | null;
  holidayName: string | null;
  todayIso: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<AttendanceFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !employee) return;
    setCheckInTime(record?.checkInAt ? formatClockID(record.checkInAt) : "");
    setCheckOutTime(
      record?.checkOutAt ? formatClockID(record.checkOutAt) : ""
    );
    setReason("");
    setErrors({});
    setFormError("");
    setSaving(false);
  }, [open, employee, record?.id, record?.checkInAt, record?.checkOutAt]);

  const previewRecord = useMemo<AttendanceRecord | null>(() => {
    if (!employee || !checkInTime) return null;
    return {
      id: "preview",
      employeeId: employee.id,
      workDate: date,
      checkInAt: `${date}T${checkInTime}:00+07:00`,
      checkOutAt: checkOutTime ? `${date}T${checkOutTime}:00+07:00` : null,
      source: "Koreksi HR",
      notes: null,
      updatedAt: new Date().toISOString(),
    };
  }, [employee, date, checkInTime, checkOutTime]);

  const previewDay = useMemo(() => {
    if (!employee || !previewRecord) return null;
    return computeAttendanceDay({
      date,
      todayIso,
      schedule,
      holidayName,
      record: previewRecord,
      joinedAt: employee.joinedAt,
    });
  }, [employee, previewRecord, date, todayIso, schedule, holidayName]);

  if (!open || !employee) return null;

  const submit = async () => {
    const input = {
      employeeId: employee.id,
      workDate: date,
      checkInTime: checkInTime || null,
      checkOutTime: checkOutTime || null,
      reason: reason.trim(),
    };

    const nextErrors = validateCorrectionInput(input, { todayIso });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError(
        nextErrors.form ?? "Periksa kembali isian koreksi yang ditandai merah."
      );
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/attendance/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        errors?: AttendanceFieldErrors;
      } | null;
      if (!response.ok) {
        if (data?.errors) setErrors(data.errors);
        throw new Error(data?.error ?? "Gagal menyimpan koreksi");
      }
      onSaved("Koreksi kehadiran disimpan");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan koreksi"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rl">
      <Modal title="Koreksi Kehadiran" onClose={onClose} busy={saving}>
        {formError && <ErrorBox message={formError} />}

        <div
          className="p-3 rounded-xl text-[12px] mb-4"
          style={{ background: "#FAF7F5" }}
        >
          <div className="font-semibold">{employee.fullName}</div>
          <div className="sub mt-0.5">
            {employee.id} · {formatDateID(date)}
          </div>
        </div>

        <div className="rl-fields-grid">
          <div className="rl-field">
            <label htmlFor="correction-in">Jam masuk</label>
            <input
              id="correction-in"
              type="time"
              className="rl-input"
              value={checkInTime}
              disabled={saving}
              onChange={(event) => {
                setCheckInTime(event.target.value);
                setErrors((current) => {
                  const next = { ...current };
                  delete next.checkInTime;
                  delete next.form;
                  return next;
                });
              }}
            />
            <FieldError message={errors.checkInTime} />
          </div>

          <div className="rl-field">
            <label htmlFor="correction-out">Jam pulang</label>
            <input
              id="correction-out"
              type="time"
              className="rl-input"
              value={checkOutTime}
              disabled={saving}
              onChange={(event) => {
                setCheckOutTime(event.target.value);
                setErrors((current) => {
                  const next = { ...current };
                  delete next.checkOutTime;
                  delete next.form;
                  return next;
                });
              }}
            />
            <FieldError message={errors.checkOutTime} />
          </div>

          <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
            <label className="font-semibold">Ringkasan sebelum → sesudah</label>
            <div className="grid sm:grid-cols-2 gap-2">
              <div
                className="p-3 rounded-xl text-[12px]"
                style={{ background: "#FAF7F5" }}
              >
                <div className="text-[11px] sub">Sebelum</div>
                <div className="mt-1">
                  Masuk{" "}
                  {record?.checkInAt ? formatClockID(record.checkInAt) : "—"} ·
                  Pulang{" "}
                  {record?.checkOutAt ? formatClockID(record.checkOutAt) : "—"}
                </div>
                <div className="sub mt-1">
                  {beforeDay ? attendanceDayLabel(beforeDay) : "Belum ada data"}
                </div>
              </div>
              <div
                className="p-3 rounded-xl text-[12px]"
                style={{ background: "#F6FBF4" }}
              >
                <div className="text-[11px] sub">Sesudah</div>
                <div className="mt-1">
                  Masuk {checkInTime || "—"} · Pulang {checkOutTime || "—"}
                </div>
                <div className="sub mt-1">
                  {previewDay
                    ? attendanceDayLabel(previewDay)
                    : "Belum ada jam masuk"}
                </div>
              </div>
            </div>
          </div>

          <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="correction-reason">Alasan koreksi *</label>
            <textarea
              id="correction-reason"
              className="rl-input"
              rows={3}
              maxLength={CORRECTION_REASON_MAX}
              placeholder="cth. lupa check-out karena jaringan kantor bermasalah"
              value={reason}
              disabled={saving}
              onChange={(event) => {
                setReason(event.target.value);
                setErrors((current) => {
                  const next = { ...current };
                  delete next.reason;
                  delete next.form;
                  return next;
                });
              }}
            />
            <div className="text-[10px] sub text-right mt-0.5">
              {reason.length}/{CORRECTION_REASON_MAX}
            </div>
            <FieldError message={errors.reason} />
          </div>
        </div>

        <div className="rl-actions">
          <button
            type="button"
            className="rl-btn"
            onClick={onClose}
            disabled={saving}
          >
            Batal
          </button>
          <button
            type="button"
            className="rl-btn rl-primary"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? "Menyimpan…" : "Simpan Koreksi"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
