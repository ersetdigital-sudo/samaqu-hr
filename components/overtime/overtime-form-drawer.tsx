"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { FormDrawer } from "@/components/ui/form-drawer";
import {
  FormField,
  FormSection,
  FormUnsavedIndicator,
} from "@/components/ui/form-section";
import { InfoGrid, InfoItem } from "@/components/ui/detail-info";
import {
  addDaysIso,
  OVERTIME_BACKDATE_DAYS,
  OVERTIME_FUTURE_DAYS,
  overtimeDayType,
  overtimeDayTypeLabel,
  overtimeFormulaLabel,
  overtimeHoursLabel,
  resolveOvertimeSchedule,
  validateOvertimeInput,
} from "@/lib/overtime/rules";
import type {
  OvertimeEmployeeData,
  OvertimeFieldErrors,
  OvertimeInput,
} from "@/lib/overtime/types";
import "@/components/recruitment-live/live.css";

export function OvertimeFormDrawer({
  open,
  data,
  onClose,
  onSaved,
}: {
  open: boolean;
  data: OvertimeEmployeeData;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [requestDate, setRequestDate] = useState(data.todayIso);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [errors, setErrors] = useState<OvertimeFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRequestDate(data.todayIso);
    setStartTime("");
    setEndTime("");
    setWorkDescription("");
    setErrors({});
    setFormError("");
    setSaving(false);
    setConfirmDiscard(false);
  }, [open, data.todayIso]);

  const schedule = resolveOvertimeSchedule(
    data.schedule ? [data.schedule] : [],
    data.employee?.id ?? ""
  );
  const dayType = overtimeDayType(requestDate, schedule, data.holidays);
  const validation = validateOvertimeInput(
    { requestDate, startTime, endTime, workDescription },
    {
      todayIso: data.todayIso,
      employee: data.employee,
      schedules: schedule ? [schedule] : [],
      holidays: data.holidays,
      leaveDates: data.leaveDates,
      requests: data.requests,
    }
  );

  const dirty =
    requestDate !== data.todayIso ||
    startTime !== "" ||
    endTime !== "" ||
    workDescription.trim() !== "";

  const clearError = (key: keyof OvertimeFieldErrors) => {
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError("");
  };

  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const submit = async () => {
    setErrors(validation.errors);
    setFormError(
      validation.errors.form ??
        (Object.keys(validation.errors).length > 0
          ? "Periksa kembali isian yang ditandai merah."
          : "")
    );
    if (Object.keys(validation.errors).length > 0) return;

    const input: OvertimeInput = {
      requestDate,
      startTime,
      endTime,
      workDescription,
    };
    setSaving(true);
    try {
      const response = await fetch("/api/overtime/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        errors?: OvertimeFieldErrors;
      } | null;
      if (!response.ok) {
        if (body?.errors) setErrors(body.errors);
        throw new Error(body?.error ?? "Gagal mengirim pengajuan lembur");
      }

      setConfirmDiscard(false);
      onSaved("Pengajuan lembur berhasil dikirim");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Gagal mengirim pengajuan lembur"
      );
    } finally {
      setSaving(false);
    }
  };

  const minDate = addDaysIso(data.todayIso, -OVERTIME_BACKDATE_DAYS);
  const maxDate = addDaysIso(data.todayIso, OVERTIME_FUTURE_DAYS);
  const weeklyRemaining = validation.weeklyRemainingMinutes;

  return (
    <>
      <FormDrawer
        open={open}
        title="Ajukan Lembur"
        description="Isi tanggal, jam, dan uraian pekerjaan. Lembur lintas tengah malam belum didukung."
        size="md"
        busy={saving}
        onRequestClose={requestClose}
        footerStatus={dirty ? <FormUnsavedIndicator /> : null}
        footer={
          <>
            <button
              type="button"
              className="btn btn-g"
              onClick={requestClose}
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-p"
              onClick={() => void submit()}
              disabled={saving || !data.employee || data.employee.status === "Nonaktif"}
            >
              {saving ? "Mengirim…" : "Ajukan"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {formError && (
            <div className="tag t-bad w-full justify-center text-center whitespace-normal py-2">
              {formError}
            </div>
          )}

          <FormSection
            icon="clock"
            title="Tanggal & Jam"
            description="Jam lembur harus kelipatan 30 menit, minimal 30 menit."
          >
            <FormField
              label="Tanggal lembur"
              required
              error={errors.requestDate}
            >
              <input
                type="date"
                className="inp"
                value={requestDate}
                min={minDate}
                max={maxDate}
                disabled={saving}
                aria-invalid={Boolean(errors.requestDate)}
                onChange={(event) => {
                  setRequestDate(event.target.value);
                  clearError("requestDate");
                }}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <FormField
                label="Jam mulai"
                required
                span="half"
                error={errors.startTime}
              >
                <input
                  type="time"
                  step={1800}
                  className="inp"
                  value={startTime}
                  disabled={saving}
                  aria-invalid={Boolean(errors.startTime)}
                  onChange={(event) => {
                    setStartTime(event.target.value);
                    clearError("startTime");
                  }}
                />
              </FormField>
              <FormField
                label="Jam selesai"
                required
                span="half"
                error={errors.endTime}
              >
                <input
                  type="time"
                  step={1800}
                  className="inp"
                  value={endTime}
                  disabled={saving}
                  aria-invalid={Boolean(errors.endTime)}
                  onChange={(event) => {
                    setEndTime(event.target.value);
                    clearError("endTime");
                  }}
                />
              </FormField>
            </div>

            <div
              className="mt-3 p-3 rounded-xl text-[12px]"
              style={{ background: "#FAF7F5" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Jenis hari:</span>
                <span className="tag t-mute">
                  {dayType ? overtimeDayTypeLabel(dayType) : "Belum ditentukan"}
                </span>
              </div>
              <div className="sub mt-1">
                Maksimal 4 jam per hari dan 18 jam per minggu (Senin–Minggu).
              </div>
            </div>
          </FormSection>

          <FormSection
            icon="file"
            title="Uraian & Ringkasan"
            description="Uraian pekerjaan wajib diisi untuk audit lembur."
          >
            <FormField
              label="Uraian pekerjaan *"
              error={errors.workDescription}
            >
              <textarea
                className="inp"
                rows={3}
                maxLength={1000}
                placeholder="cth. menyelesaikan rekonsiliasi stok akhir bulan"
                value={workDescription}
                disabled={saving}
                aria-invalid={Boolean(errors.workDescription)}
                onChange={(event) => {
                  setWorkDescription(event.target.value);
                  clearError("workDescription");
                }}
              />
              <div className="text-[10px] sub text-right mt-0.5">
                {workDescription.length}/1000
              </div>
            </FormField>

            <InfoGrid>
              <InfoItem
                label="Durasi diajukan"
                value={
                  validation.minutes > 0
                    ? overtimeHoursLabel(validation.minutes)
                    : "—"
                }
              />
              <InfoItem
                label="Sisa batas minggu ini"
                value={overtimeHoursLabel(weeklyRemaining)}
              />
              <InfoItem
                label="Perkiraan ekuivalen"
                value={
                  dayType && validation.minutes > 0
                    ? overtimeFormulaLabel(validation.minutes, dayType)
                    : "—"
                }
                full
              />
            </InfoGrid>
            {dayType && validation.minutes > 0 && (
              <div className="text-[11px] sub mt-2">
                Ekuivalen final mengikuti jam yang disetujui HR.
              </div>
            )}
          </FormSection>
        </div>
      </FormDrawer>

      {confirmDiscard && (
        <div className="rl">
          <ConfirmDialog
            title="Tutup form?"
            description="Isian pengajuan lembur belum dikirim dan akan hilang."
            confirmLabel="Ya, tutup"
            busy={false}
            danger
            onClose={() => setConfirmDiscard(false)}
            onConfirm={() => {
              setConfirmDiscard(false);
              onClose();
            }}
          />
        </div>
      )}
    </>
  );
}
