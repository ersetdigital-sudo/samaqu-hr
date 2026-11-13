"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import {
  FormDrawer,
} from "@/components/ui/form-drawer";
import {
  FormField,
  FormSection,
  FormSectionNav,
  FormUnsavedIndicator,
} from "@/components/ui/form-section";
import { InfoGrid, InfoItem } from "@/components/ui/detail-info";
import {
  useDrawerSectionNav,
  type DrawerNavSection,
} from "@/components/ui/use-drawer-section-nav";
import { formatDateID } from "@/lib/datetime";
import { formatFileSize } from "@/lib/documents/query";
import {
  LEAVE_ATTACHMENT_ACCEPT,
  LEAVE_ATTACHMENT_MAX_BYTES,
  LEAVE_ATTACHMENT_SIZE_LABEL,
  validateLeaveAttachmentMeta,
} from "@/lib/leave/validation";
import {
  addDaysIso,
  countLeaveDays,
  leaveBalanceDisplay,
  leaveCategoryLabel,
  leaveTypeFor,
  needsDoctorNote,
  validateLeaveInput,
} from "@/lib/leave/rules";
import type {
  LeaveEmployeeData,
  LeaveFieldErrors,
} from "@/lib/leave/types";
import "@/components/recruitment-live/live.css";

const FORM_SECTIONS: DrawerNavSection[] = [
  { id: "leave-form-type", label: "Jenis & Tanggal" },
  { id: "leave-form-detail", label: "Alasan & Lampiran" },
  { id: "leave-form-summary", label: "Ringkasan" },
];

function defaultTypeCode(data: LeaveEmployeeData): string {
  const active = data.types.filter((type) => type.isActive);
  const annual = active.find((type) => type.category === "annual");
  if (annual && data.balance?.eligible) return annual.code;
  return (
    active.find((type) => type.category === "permission")?.code ??
    annual?.code ??
    active[0]?.code ??
    ""
  );
}

export function LeaveRequestFormDrawer({
  open,
  data,
  onClose,
  onSaved,
}: {
  open: boolean;
  data: LeaveEmployeeData;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [typeCode, setTypeCode] = useState("");
  const [startDate, setStartDate] = useState(data.todayIso);
  const [endDate, setEndDate] = useState(data.todayIso);
  const [reason, setReason] = useState("");
  const [eventNote, setEventNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<LeaveFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { bodyRef, activeId, scrollToSection } = useDrawerSectionNav(
    FORM_SECTIONS,
    open
  );

  const initialType = useMemo(() => defaultTypeCode(data), [data]);
  const type = leaveTypeFor(data.types, typeCode) ?? null;
  const balanceView = leaveBalanceDisplay(data.balance, data.todayIso);

  useEffect(() => {
    if (!open) return;
    setTypeCode(initialType);
    setStartDate(data.todayIso);
    setEndDate(data.todayIso);
    setReason("");
    setEventNote("");
    setFile(null);
    setFileError(null);
    setErrors({});
    setFormError("");
    setSaving(false);
    setConfirmDiscard(false);
  }, [open, data.todayIso, initialType]);

  const days = type
    ? countLeaveDays({
        type,
        startDate,
        endDate,
        schedule: data.schedule,
        holidays: data.holidays,
      })
    : 0;

  const context = {
    todayIso: data.todayIso,
    employee: data.employee,
    types: data.types,
    schedule: data.schedule,
    holidays: data.holidays,
    balance: data.balance,
    requests: data.requests,
    hasAttachment: Boolean(file) && !fileError,
    attachmentError: fileError,
  };

  const dirty =
    typeCode !== initialType ||
    startDate !== data.todayIso ||
    endDate !== data.todayIso ||
    reason.trim() !== "" ||
    eventNote.trim() !== "" ||
    Boolean(file);

  const clearError = (key: keyof LeaveFieldErrors) => {
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError("");
  };

  const validateField = (key: keyof LeaveFieldErrors) => {
    const result = validateLeaveInput(
      {
        leaveTypeCode: typeCode,
        startDate,
        endDate,
        reason,
        eventNote,
      },
      context
    );
    setErrors((current) => {
      const next = { ...current };
      if (result.errors[key]) next[key] = result.errors[key];
      else delete next[key];
      return next;
    });
  };

  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const pickFile = (value: File | null) => {
    setFile(value);
    setFileError(null);
    clearError("attachment");
    if (!value) return;
    const message = validateLeaveAttachmentMeta(value);
    if (message) {
      setFileError(message);
      setErrors((current) => ({ ...current, attachment: message }));
    }
  };

  const submit = async () => {
    const result = validateLeaveInput(
      {
        leaveTypeCode: typeCode,
        startDate,
        endDate,
        reason,
        eventNote,
      },
      context
    );
    setErrors(result.errors);
    setFormError(
      result.errors.form ??
        (Object.keys(result.errors).length > 0
          ? "Periksa kembali isian yang ditandai merah."
          : "")
    );
    if (Object.keys(result.errors).length > 0) return;

    setSaving(true);
    try {
      const form = new FormData();
      form.append("leaveTypeCode", typeCode);
      form.append("startDate", startDate);
      form.append("endDate", endDate);
      form.append("reason", reason);
      form.append("eventNote", eventNote);
      if (file) form.append("attachment", file);

      const response = await fetch("/api/leave/requests", {
        method: "POST",
        body: form,
      });
      const contentType = response.headers.get("content-type") ?? "";
      const body = contentType.includes("application/json")
        ? ((await response.json().catch(() => null)) as {
            error?: string;
            errors?: LeaveFieldErrors;
          } | null)
        : null;

      if (!response.ok) {
        if (response.status === 413 || !body) {
          throw new Error(
            `File terlalu besar, maksimal ${LEAVE_ATTACHMENT_SIZE_LABEL}`
          );
        }
        if (body.errors) setErrors(body.errors);
        throw new Error(body.error ?? "Gagal mengirim pengajuan cuti");
      }

      setConfirmDiscard(false);
      onSaved("Pengajuan cuti berhasil dikirim");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Gagal mengirim pengajuan cuti"
      );
    } finally {
      setSaving(false);
    }
  };

  const minStart = type
    ? addDaysIso(data.todayIso, -type.allowPastDays)
    : data.todayIso;

  return (
    <>
      <FormDrawer
        open={open}
        title="Ajukan Cuti & Izin"
        description="Satu pengajuan untuk satu jenis cuti. Hari kerja dihitung otomatis."
        size="md"
        busy={saving}
        onRequestClose={requestClose}
        bodyRef={bodyRef}
        subnav={
          <FormSectionNav
            items={FORM_SECTIONS}
            activeId={activeId}
            onSelect={scrollToSection}
          />
        }
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
            sectionId="leave-form-type"
            icon="cal"
            title="Jenis & Tanggal"
            description="Pilih jenis cuti lalu rentang tanggalnya."
          >
            <FormField
              label="Jenis cuti"
              required
              error={errors.leaveTypeCode}
            >
              <select
                className="inp"
                value={typeCode}
                disabled={saving}
                aria-invalid={Boolean(errors.leaveTypeCode)}
                onChange={(event) => {
                  setTypeCode(event.target.value);
                  setErrors(fileError ? { attachment: fileError } : {});
                  setFormError("");
                }}
              >
                {data.types
                  .filter((item) => item.isActive)
                  .map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </FormField>

            {type?.description && (
              <p className="text-[11px] sub mt-2">{type.description}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <FormField
                label="Tanggal mulai"
                required
                span="half"
                error={errors.startDate}
              >
                <input
                  type="date"
                  className="inp"
                  value={startDate}
                  min={minStart}
                  disabled={saving}
                  aria-invalid={Boolean(errors.startDate)}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    clearError("startDate");
                    if (endDate < event.target.value) {
                      setEndDate(event.target.value);
                      clearError("endDate");
                    }
                  }}
                  onBlur={() => validateField("startDate")}
                />
              </FormField>
              <FormField
                label="Tanggal selesai"
                required
                span="half"
                error={errors.endDate}
              >
                <input
                  type="date"
                  className="inp"
                  value={endDate}
                  min={startDate || minStart}
                  disabled={saving}
                  aria-invalid={Boolean(errors.endDate)}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    clearError("endDate");
                  }}
                  onBlur={() => validateField("endDate")}
                />
              </FormField>
            </div>

            <div
              className="mt-3 p-3 rounded-xl text-[12px]"
              style={{ background: "#FAF7F5" }}
            >
              <div className="font-semibold">
                {days > 0
                  ? `${days} ${type?.countsCalendarDays ? "hari kalender" : "hari kerja"}`
                  : "Hitung hari setelah tanggal dipilih"}
              </div>
              <div className="sub mt-1">
                {type?.countsCalendarDays
                  ? "Jenis ini dihitung hari kalender."
                  : "Mengikuti jadwal kerja aktif dan kalender libur nasional/cuti bersama."}
              </div>
            </div>
          </FormSection>

          <FormSection
            sectionId="leave-form-detail"
            icon="file"
            title="Alasan & Lampiran"
            description="Lengkapi keterangan sesuai aturan jenis cuti."
          >
            <FormField
              label={`Alasan${type?.requiresReason ? " *" : " (opsional)"}`}
              error={errors.reason}
            >
              <textarea
                className="inp"
                rows={3}
                maxLength={1000}
                placeholder="Tuliskan alasan pengajuan…"
                value={reason}
                disabled={saving}
                aria-invalid={Boolean(errors.reason)}
                onChange={(event) => {
                  setReason(event.target.value);
                  clearError("reason");
                }}
                onBlur={() => validateField("reason")}
              />
              <div className="text-[10px] sub text-right mt-0.5">
                {reason.length}/1000
              </div>
            </FormField>

            {type?.requiresEventNote && (
              <FormField
                label="Keterangan kejadian *"
                error={errors.eventNote}
                hint="cth. tanggal akad, nama anggota keluarga, atau keterangan medis."
              >
                <textarea
                  className="inp"
                  rows={2}
                  maxLength={500}
                  placeholder="Jelaskan kejadian yang mendasari cuti khusus…"
                  value={eventNote}
                  disabled={saving}
                  aria-invalid={Boolean(errors.eventNote)}
                  onChange={(event) => {
                    setEventNote(event.target.value);
                    clearError("eventNote");
                  }}
                  onBlur={() => validateField("eventNote")}
                />
              </FormField>
            )}

            <FormField
              label="Lampiran"
              error={errors.attachment}
              hint={
                type && needsDoctorNote(type, days)
                  ? `Surat dokter wajib untuk sakit ${type.requiresDoctorNoteAfterWorkdays} hari kerja atau lebih.`
                  : `Opsional. PDF, JPG, atau PNG maksimal ${LEAVE_ATTACHMENT_SIZE_LABEL}.`
              }
            >
              <input
                type="file"
                className="inp"
                accept={LEAVE_ATTACHMENT_ACCEPT}
                disabled={saving}
                aria-invalid={Boolean(errors.attachment)}
                onChange={(event) =>
                  pickFile(event.target.files?.[0] ?? null)
                }
              />
              {file && (
                <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] sub">
                  <span className="font-semibold" style={{ color: "var(--ink)" }}>
                    {file.name}
                  </span>
                  <span>{formatFileSize(file.size)}</span>
                  <span>
                    maks {LEAVE_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MB
                  </span>
                  <button
                    type="button"
                    className="btn btn-g !py-1 !px-2 !text-[11px]"
                    onClick={() => {
                      setFile(null);
                      setFileError(null);
                      clearError("attachment");
                    }}
                    disabled={saving}
                  >
                    Hapus
                  </button>
                </div>
              )}
            </FormField>
          </FormSection>

          <FormSection
            sectionId="leave-form-summary"
            icon="clock"
            title="Ringkasan"
            description="Periksa dampak pengajuan terhadap saldo dan kuota."
          >
            <InfoGrid>
              <InfoItem
                label="Jenis"
                value={
                  type
                    ? `${type.name} · ${leaveCategoryLabel(type.category)}`
                    : "—"
                }
                full
              />
              <InfoItem
                label="Rentang"
                value={`${formatDateID(startDate)} – ${formatDateID(endDate)}`}
                full
              />
              <InfoItem
                label="Jumlah"
                value={`${days} ${
                  type?.countsCalendarDays ? "hari kalender" : "hari kerja"
                }`}
              />
              {type?.deductsAnnualBalance ? (
                <>
                  <InfoItem
                    label="Hak tahunan"
                    value={`${balanceView?.entitlement ?? 0} hari`}
                  />
                  <InfoItem
                    label="Sisa setelah pengajuan"
                    value={`${Math.max(
                      (balanceView?.remaining ?? 0) - days,
                      0
                    )} hari`}
                  />
                  <InfoItem
                    label="Status hak"
                    value={
                      balanceView
                        ? `${balanceView.statusLabel}${
                            balanceView.activeDateLabel
                              ? ` · aktif ${balanceView.activeDateLabel}`
                              : ""
                          }`
                        : "—"
                    }
                    full
                  />
                </>
              ) : type?.quotaDays !== null && type?.quotaDays !== undefined ? (
                <>
                  <InfoItem label="Kuota" value={`${type.quotaDays} hari`} />
                  <InfoItem
                    label="Sisa kuota pengajuan ini"
                    value={`${Math.max(type.quotaDays - days, 0)} hari`}
                  />
                </>
              ) : (
                <InfoItem
                  label="Saldo tahunan"
                  value="Tidak mengurangi saldo cuti tahunan"
                  full
                />
              )}
            </InfoGrid>
            {type?.category === "sick" && needsDoctorNote(type, days) && (
              <div className="text-[11px] mt-2" style={{ color: "var(--warn)" }}>
                Lampiran surat dokter wajib sebelum pengajuan dikirim.
              </div>
            )}
          </FormSection>
        </div>
      </FormDrawer>

      {confirmDiscard && (
        <div className="rl">
          <ConfirmDialog
            title="Tutup form?"
            description="Isian pengajuan belum dikirim dan akan hilang."
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
