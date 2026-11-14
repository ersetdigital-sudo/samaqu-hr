"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { FormDrawer } from "@/components/ui/form-drawer";
import {
  FormField,
  FormSection,
  FormSectionNav,
  FormUnsavedIndicator,
} from "@/components/ui/form-section";
import {
  useDrawerSectionNav,
  type DrawerNavSection,
} from "@/components/ui/use-drawer-section-nav";
import { formatDateID, formatDateTimeID } from "@/lib/datetime";
import { ini } from "@/lib/data";
import {
  formatRupiah,
  jkkRiskClassLabel,
  validatePayrollProfileInput,
} from "@/lib/payroll/rules";
import {
  JKK_RISK_CLASSES,
  PTKP_STATUSES,
  type JkkRiskClass,
  type PayrollProfileFieldErrors,
  type PayrollProfileRecord,
  type PtkpStatus,
} from "@/lib/payroll/types";
import "@/components/recruitment-live/live.css";

const SECTIONS: DrawerNavSection[] = [
  { id: "payroll-profile-salary", label: "Gaji & PTKP" },
  { id: "payroll-profile-bank", label: "BPJS & Rekening" },
  { id: "payroll-profile-history", label: "Riwayat" },
];

const salaryOf = (data: Record<string, unknown> | null): string => {
  if (!data) return "—";
  const value = data.base_salary;
  return typeof value === "number" ? formatRupiah(value) : "—";
};

export function PayrollProfileDrawer({
  record,
  open,
  todayIso,
  onClose,
  onSaved,
}: {
  record: PayrollProfileRecord | null;
  open: boolean;
  todayIso: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [baseSalary, setBaseSalary] = useState(0);
  const [fixedAllowance, setFixedAllowance] = useState(0);
  const [variableAllowance, setVariableAllowance] = useState(0);
  const [ptkpStatus, setPtkpStatus] = useState<PtkpStatus | "">("");
  const [npwp, setNpwp] = useState("");
  const [bpjsKesehatanNumber, setBpjsKesehatanNumber] = useState("");
  const [bpjsKetenagakerjaanNumber, setBpjsKetenagakerjaanNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [jkkRiskClass, setJkkRiskClass] = useState<JkkRiskClass>("very_low");
  const [effectiveDate, setEffectiveDate] = useState(todayIso);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<PayrollProfileFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { bodyRef, activeId, scrollToSection } = useDrawerSectionNav(
    SECTIONS,
    open
  );

  const initial = useMemo(
    () =>
      record?.profile
        ? {
            baseSalary: record.profile.baseSalary,
            fixedAllowance: record.profile.fixedAllowance,
            variableAllowance: record.profile.variableAllowance,
            ptkpStatus: record.profile.ptkpStatus ?? "",
            npwp: record.profile.npwp ?? "",
            bpjsKesehatanNumber: record.profile.bpjsKesehatanNumber ?? "",
            bpjsKetenagakerjaanNumber:
              record.profile.bpjsKetenagakerjaanNumber ?? "",
            bankName: record.profile.bankName ?? "",
            bankAccountNumber: record.profile.bankAccountNumber ?? "",
            bankAccountHolder: record.profile.bankAccountHolder ?? "",
            jkkRiskClass: record.profile.jkkRiskClass,
            effectiveDate: record.profile.effectiveDate,
            notes: record.profile.notes ?? "",
          }
        : {
            baseSalary: 0,
            fixedAllowance: 0,
            variableAllowance: 0,
            ptkpStatus: "",
            npwp: "",
            bpjsKesehatanNumber: "",
            bpjsKetenagakerjaanNumber: "",
            bankName: "",
            bankAccountNumber: "",
            bankAccountHolder: "",
            jkkRiskClass: "very_low" as JkkRiskClass,
            effectiveDate: todayIso,
            notes: "",
          },
    [record, todayIso]
  );

  useEffect(() => {
    if (!open) return;
    setBaseSalary(initial.baseSalary);
    setFixedAllowance(initial.fixedAllowance);
    setVariableAllowance(initial.variableAllowance);
    setPtkpStatus(initial.ptkpStatus as PtkpStatus | "");
    setNpwp(initial.npwp);
    setBpjsKesehatanNumber(initial.bpjsKesehatanNumber);
    setBpjsKetenagakerjaanNumber(initial.bpjsKetenagakerjaanNumber);
    setBankName(initial.bankName);
    setBankAccountNumber(initial.bankAccountNumber);
    setBankAccountHolder(initial.bankAccountHolder);
    setJkkRiskClass(initial.jkkRiskClass);
    setEffectiveDate(initial.effectiveDate);
    setNotes(initial.notes);
    setReason("");
    setErrors({});
    setFormError("");
    setSaving(false);
    setConfirmDiscard(false);
  }, [open, initial]);

  const dirty =
    baseSalary !== initial.baseSalary ||
    fixedAllowance !== initial.fixedAllowance ||
    variableAllowance !== initial.variableAllowance ||
    ptkpStatus !== initial.ptkpStatus ||
    npwp !== initial.npwp ||
    bpjsKesehatanNumber !== initial.bpjsKesehatanNumber ||
    bpjsKetenagakerjaanNumber !== initial.bpjsKetenagakerjaanNumber ||
    bankName !== initial.bankName ||
    bankAccountNumber !== initial.bankAccountNumber ||
    bankAccountHolder !== initial.bankAccountHolder ||
    jkkRiskClass !== initial.jkkRiskClass ||
    effectiveDate !== initial.effectiveDate ||
    notes !== initial.notes ||
    reason.trim() !== "";

  const requestClose = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const submit = async () => {
    if (!record) return;
    const validation = validatePayrollProfileInput({
      baseSalary,
      fixedAllowance,
      variableAllowance,
      ptkpStatus: ptkpStatus || null,
      jkkRiskClass,
      effectiveDate,
    });
    setErrors(validation);
    setFormError(
      Object.keys(validation).length > 0
        ? "Periksa kembali isian yang ditandai merah."
        : ""
    );
    if (Object.keys(validation).length > 0) return;
    if (!reason.trim()) {
      setFormError("Alasan perubahan profil wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/payroll/profiles/${encodeURIComponent(record.employee.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: reason.trim(),
            profile: {
              baseSalary,
              fixedAllowance,
              variableAllowance,
              ptkpStatus: ptkpStatus || null,
              npwp,
              bpjsKesehatanNumber,
              bpjsKetenagakerjaanNumber,
              bankName,
              bankAccountNumber,
              bankAccountHolder,
              jkkRiskClass,
              effectiveDate,
              notes,
            },
          }),
        }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        errors?: PayrollProfileFieldErrors;
      } | null;
      if (!response.ok) {
        if (body?.errors) setErrors(body.errors);
        throw new Error(body?.error ?? "Gagal menyimpan profil payroll");
      }
      onSaved("Profil payroll disimpan");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan profil payroll"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormDrawer
        open={open}
        title="Profil Gaji Karyawan"
        description={
          record
            ? `${record.employee.fullName} · ${record.employee.id}`
            : undefined
        }
        size="lg"
        busy={saving}
        onRequestClose={requestClose}
        bodyRef={bodyRef}
        subnav={
          <FormSectionNav
            items={SECTIONS}
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
              disabled={saving || !record}
            >
              {saving ? "Menyimpan…" : "Simpan Profil"}
            </button>
          </>
        }
      >
        {record && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="av" style={{ width: 52, height: 52, fontSize: 17 }}>
                {ini(record.employee.fullName)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-[17px]">
                  {record.employee.fullName}
                </div>
                <div className="sub text-[12px]">
                  {record.employee.id} · {record.employee.department}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {record.issues.length === 0 ? (
                    <span className="tag t-ok">Profil lengkap</span>
                  ) : (
                    record.issues.map((issue) => (
                      <span className="tag t-warn" key={issue}>
                        {issue}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {formError && (
              <div className="tag t-bad w-full justify-center text-center whitespace-normal py-2">
                {formError}
              </div>
            )}

            <FormSection
              sectionId="payroll-profile-salary"
              icon="wallet"
              title="Gaji & PTKP"
              description="Komponen tetap dan status pajak karyawan."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Gaji pokok" required error={errors.baseSalary}>
                  <input
                    type="number"
                    className="inp"
                    min={0}
                    value={baseSalary}
                    disabled={saving}
                    onChange={(event) => {
                      setBaseSalary(Number(event.target.value));
                      setErrors((current) => ({ ...current, baseSalary: "" }));
                    }}
                  />
                </FormField>
                <FormField label="Tunjangan tetap">
                  <input
                    type="number"
                    className="inp"
                    min={0}
                    value={fixedAllowance}
                    disabled={saving}
                    onChange={(event) =>
                      setFixedAllowance(Number(event.target.value))
                    }
                  />
                </FormField>
                <FormField label="Tunjangan tidak tetap">
                  <input
                    type="number"
                    className="inp"
                    min={0}
                    value={variableAllowance}
                    disabled={saving}
                    onChange={(event) =>
                      setVariableAllowance(Number(event.target.value))
                    }
                  />
                </FormField>
                <FormField label="Status PTKP" required error={errors.ptkpStatus}>
                  <select
                    className="inp"
                    value={ptkpStatus}
                    disabled={saving}
                    onChange={(event) =>
                      setPtkpStatus(event.target.value as PtkpStatus | "")
                    }
                  >
                    <option value="">Pilih status PTKP</option>
                    {PTKP_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Kelas risiko JKK" error={errors.jkkRiskClass}>
                  <select
                    className="inp"
                    value={jkkRiskClass}
                    disabled={saving}
                    onChange={(event) =>
                      setJkkRiskClass(event.target.value as JkkRiskClass)
                    }
                  >
                    {JKK_RISK_CLASSES.map((risk) => (
                      <option key={risk} value={risk}>
                        {jkkRiskClassLabel(risk)}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Tanggal berlaku" error={errors.effectiveDate}>
                  <input
                    type="date"
                    className="inp"
                    value={effectiveDate}
                    disabled={saving}
                    onChange={(event) => setEffectiveDate(event.target.value)}
                  />
                </FormField>
              </div>
              <div className="text-[11px] sub mt-2">
                Gaji pokok + tunjangan tetap menjadi dasar BPJS dan upah lembur.
              </div>
            </FormSection>

            <FormSection
              sectionId="payroll-profile-bank"
              icon="file"
              title="BPJS & Rekening"
              description="Data ini hanya dapat dibaca Admin dan HR Manager."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="NPWP (opsional)" span="full">
                  <input
                    className="inp"
                    value={npwp}
                    disabled={saving}
                    placeholder="Kosongkan bila belum ada"
                    onChange={(event) => setNpwp(event.target.value)}
                  />
                </FormField>
                <FormField label="Nomor BPJS Kesehatan">
                  <input
                    className="inp"
                    value={bpjsKesehatanNumber}
                    disabled={saving}
                    onChange={(event) =>
                      setBpjsKesehatanNumber(event.target.value)
                    }
                  />
                </FormField>
                <FormField label="Nomor BPJS Ketenagakerjaan">
                  <input
                    className="inp"
                    value={bpjsKetenagakerjaanNumber}
                    disabled={saving}
                    onChange={(event) =>
                      setBpjsKetenagakerjaanNumber(event.target.value)
                    }
                  />
                </FormField>
                <FormField label="Nama bank">
                  <input
                    className="inp"
                    value={bankName}
                    disabled={saving}
                    placeholder="cth. BCA"
                    onChange={(event) => setBankName(event.target.value)}
                  />
                </FormField>
                <FormField label="Nomor rekening">
                  <input
                    className="inp"
                    value={bankAccountNumber}
                    disabled={saving}
                    onChange={(event) =>
                      setBankAccountNumber(event.target.value)
                    }
                  />
                </FormField>
                <FormField label="Nama pemilik rekening" span="full">
                  <input
                    className="inp"
                    value={bankAccountHolder}
                    disabled={saving}
                    onChange={(event) =>
                      setBankAccountHolder(event.target.value)
                    }
                  />
                </FormField>
                <FormField label="Catatan" span="full">
                  <textarea
                    className="inp"
                    rows={2}
                    maxLength={500}
                    value={notes}
                    disabled={saving}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </FormField>
              </div>
            </FormSection>

            <FormSection
              sectionId="payroll-profile-history"
              icon="clock"
              title="Riwayat & Alasan"
              description="Alasan perubahan wajib diisi dan masuk ke riwayat."
            >
              <FormField label="Alasan perubahan *" error={formError}>
                <textarea
                  className="inp"
                  rows={2}
                  maxLength={1000}
                  placeholder="cth. kenaikan gaji tahunan"
                  value={reason}
                  disabled={saving}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setFormError("");
                  }}
                />
              </FormField>
              {record.history.length > 0 && (
                <div className="flex flex-col gap-2 mt-4">
                  {record.history.slice(0, 10).map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-xl text-[12px]"
                      style={{ background: "#FAF7F5" }}
                    >
                      <div className="font-semibold">
                        {salaryOf(entry.oldData)} → {salaryOf(entry.newData)}
                      </div>
                      <div className="sub">
                        {formatDateTimeID(entry.changedAt)} ·{" "}
                        {entry.changedByName} · {entry.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </FormSection>
          </div>
        )}
      </FormDrawer>

      {confirmDiscard && (
        <div className="rl">
          <ConfirmDialog
            title="Tutup form?"
            description="Perubahan profil payroll belum disimpan dan akan hilang."
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
