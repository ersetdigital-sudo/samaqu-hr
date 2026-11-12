"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { FormDrawer } from "@/components/ui/form-drawer";
import {
  DEPARTMENTS,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
  LOCATIONS,
  type EmployeeDetail,
  type EmployeeInput,
  type EmployeeSummary,
  type EmployeeStatus,
  type EmploymentType,
  type Gender,
} from "@/lib/employees/types";
import { isoToday } from "@/lib/employees/format";
import { validateEmployee, type EmployeeErrors } from "@/lib/employees/validation";
import "@/components/recruitment-live/live.css";

const emptyForm = (): EmployeeInput => ({
  fullName: "",
  position: "",
  department: DEPARTMENTS[0],
  location: LOCATIONS[0],
  managerId: null,
  joinedAt: isoToday(),
  employmentType: "Tetap",
  status: "Aktif",
  gender: "Laki-laki",
  birthPlace: "",
  birthDate: "",
  address: "",
  nik: "",
  personalEmail: "",
  workEmail: "",
  phone: "",
  emergencyName: "",
  emergencyRelation: "",
  emergencyPhone: "",
  probationStart: null,
  probationEnd: null,
});

/** Buang id & nama atasan (turunan) sebelum data dipakai sebagai form. */
const toInput = (detail: EmployeeDetail): EmployeeInput => ({
  fullName: detail.fullName,
  position: detail.position,
  department: detail.department,
  location: detail.location,
  managerId: detail.managerId,
  joinedAt: detail.joinedAt,
  employmentType: detail.employmentType,
  status: detail.status,
  gender: detail.gender,
  birthPlace: detail.birthPlace,
  birthDate: detail.birthDate,
  address: detail.address,
  nik: detail.nik,
  personalEmail: detail.personalEmail,
  workEmail: detail.workEmail,
  phone: detail.phone,
  emergencyName: detail.emergencyName,
  emergencyRelation: detail.emergencyRelation,
  emergencyPhone: detail.emergencyPhone,
  probationStart: detail.probationStart,
  probationEnd: detail.probationEnd,
});

const normalized = (input: EmployeeInput): EmployeeInput => ({
  ...input,
  managerId: input.managerId || null,
  probationStart: input.probationStart || null,
  probationEnd: input.probationEnd || null,
});

const signature = (input: EmployeeInput) =>
  JSON.stringify(normalized(input));

/** Urutan visual field; dipakai untuk scroll ke error pertama. */
const FIELD_ORDER: (keyof EmployeeInput)[] = [
  "fullName",
  "birthPlace",
  "birthDate",
  "address",
  "nik",
  "position",
  "department",
  "location",
  "joinedAt",
  "personalEmail",
  "workEmail",
  "phone",
  "emergencyName",
  "emergencyRelation",
  "emergencyPhone",
  "probationStart",
  "probationEnd",
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
      {message}
    </div>
  );
}

export function EmployeeFormDrawer({
  open,
  initial,
  initialInput = null,
  warning = null,
  applicationId = null,
  nextId,
  managers,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: EmployeeDetail | null;
  initialInput?: Partial<EmployeeInput> | null;
  warning?: string | null;
  applicationId?: string | null;
  nextId: string;
  managers: EmployeeSummary[];
  onClose: () => void;
  onSaved: (message: string, employee?: EmployeeSummary) => void;
}) {
  const [form, setForm] = useState<EmployeeInput>(emptyForm);
  const [errors, setErrors] = useState<EmployeeErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const baselineRef = useRef<EmployeeInput | null>(null);

  useEffect(() => {
    if (!open) return;

    const nextForm = initial
      ? toInput(initial)
      : { ...emptyForm(), ...(initialInput ?? {}) };

    setForm(nextForm);
    baselineRef.current = nextForm;
    setErrors({});
    setFormError(null);
    setSaving(false);
    setDiscardOpen(false);
  }, [open, initial, initialInput]);

  const dirty =
    baselineRef.current !== null &&
    signature(form) !== signature(baselineRef.current);

  const requestClose = () => {
    if (saving) return;
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  const focusFirstError = (nextErrors: EmployeeErrors) => {
    const orderedKey =
      FIELD_ORDER.find((key) => Boolean(nextErrors[key])) ??
      Object.keys(nextErrors)[0];

    if (!orderedKey) return;

    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-employee-field="${orderedKey}"]`
      );
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const set = <K extends keyof EmployeeInput,>(
    key: K,
    value: EmployeeInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async () => {
    const payload: EmployeeInput = {
      ...form,
      managerId: form.managerId || null,
      probationStart: form.probationStart || null,
      probationEnd: form.probationEnd || null,
    };

    const nextErrors = validateEmployee(payload);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError("Periksa kembali field yang ditandai merah.");
      focusFirstError(nextErrors);
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const response = await fetch(
        initial ? `/api/employees/${initial.id}` : "/api/employees",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            applicationId ? { ...payload, applicationId } : payload
          ),
        }
      );

      const data = (await response.json()) as {
        error?: string;
        errors?: EmployeeErrors;
        employee?: EmployeeSummary;
      };

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors);
          focusFirstError(data.errors);
        }
        throw new Error(data.error ?? "Gagal menyimpan data karyawan");
      }

      onSaved(
        initial
          ? "Data karyawan diperbarui"
          : applicationId
            ? "Pelamar berhasil dikonversi menjadi karyawan"
            : "Karyawan baru ditambahkan",
        data.employee
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menyimpan data karyawan"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormDrawer
        open={open}
        title={initial ? "Edit Data Karyawan" : "Tambah Karyawan"}
        description={
          applicationId
            ? "Data dari lamaran sudah terisi. Lengkapi sisanya sebelum menyimpan."
            : initial
              ? "Perbarui data karyawan. Field dan aturan validasi tetap sama dengan Direktori."
              : "Employee ID dibuat otomatis oleh sistem dan dipakai seluruh modul HRIS."
        }
        busy={saving}
        onRequestClose={requestClose}
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
              disabled={saving}
            >
              {saving
                ? "Menyimpan…"
                : applicationId
                  ? "Simpan & Jadikan Karyawan"
                  : "Simpan"}
            </button>
          </>
        }
      >
        {formError && (
          <div
            className="mb-4 p-3 rounded-xl text-[12px]"
            style={{ background: "var(--badb)", color: "var(--bad)" }}
          >
            {formError}
          </div>
        )}

        {warning && (
          <div
            className="mb-4 p-3 rounded-xl text-[12px]"
            style={{ background: "#FFF7E6", color: "#8A5A12" }}
            role="status"
          >
            {warning}
          </div>
        )}

        <div className="mb-5">
          <label className="lbl">Employee ID</label>
          <input
            className="inp"
            value={initial ? initial.id : nextId}
            readOnly
            disabled
          />
          <div className="text-[11px] sub mt-1">
            Tidak bisa diubah manual — dibuat berurutan oleh sistem.
          </div>
        </div>

        <div className="font-bold text-[13px] mb-3">Identitas</div>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="lbl">Nama lengkap *</label>
            <input
              className="inp"
              data-employee-field="fullName"
              value={form.fullName}
              onChange={(event) => set("fullName", event.target.value)}
            />
            <FieldError message={errors.fullName} />
          </div>
          <div>
            <label className="lbl">Jenis kelamin</label>
            <select
              className="inp"
              data-employee-field="gender"
              value={form.gender}
              onChange={(event) => set("gender", event.target.value as Gender)}
            >
              {GENDERS.map((gender) => (
                <option key={gender}>{gender}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Tempat lahir *</label>
            <input
              className="inp"
              data-employee-field="birthPlace"
              value={form.birthPlace}
              onChange={(event) => set("birthPlace", event.target.value)}
            />
            <FieldError message={errors.birthPlace} />
          </div>
          <div>
            <label className="lbl">Tanggal lahir *</label>
            <input
              className="inp"
              data-employee-field="birthDate"
              type="date"
              value={form.birthDate}
              onChange={(event) => set("birthDate", event.target.value)}
            />
            <FieldError message={errors.birthDate} />
          </div>
          <div className="md:col-span-2">
            <label className="lbl">Alamat *</label>
            <textarea
              className="inp"
              data-employee-field="address"
              rows={2}
              value={form.address}
              onChange={(event) => set("address", event.target.value)}
            />
            <FieldError message={errors.address} />
          </div>
          <div>
            <label className="lbl">NIK KTP *</label>
            <input
              className="inp"
              data-employee-field="nik"
              inputMode="numeric"
              maxLength={16}
              value={form.nik}
              onChange={(event) => set("nik", event.target.value)}
            />
            <FieldError message={errors.nik} />
            <div className="text-[11px] sub mt-1">
              Hanya tampil di detail identitas untuk role berhak.
            </div>
          </div>
        </div>

        <div className="font-bold text-[13px] mb-3">Data Pekerjaan</div>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="lbl">Jabatan *</label>
            <input
              className="inp"
              data-employee-field="position"
              value={form.position}
              onChange={(event) => set("position", event.target.value)}
            />
            <FieldError message={errors.position} />
          </div>
          <div>
            <label className="lbl">Departemen *</label>
            <select
              className="inp"
              data-employee-field="department"
              value={form.department}
              onChange={(event) => set("department", event.target.value)}
            >
              {DEPARTMENTS.map((department) => (
                <option key={department}>{department}</option>
              ))}
            </select>
            <FieldError message={errors.department} />
          </div>
          <div>
            <label className="lbl">Lokasi kerja *</label>
            <select
              className="inp"
              data-employee-field="location"
              value={form.location}
              onChange={(event) => set("location", event.target.value)}
            >
              {LOCATIONS.map((location) => (
                <option key={location}>{location}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Atasan langsung</label>
            <select
              className="inp"
              data-employee-field="managerId"
              value={form.managerId ?? ""}
              onChange={(event) =>
                set("managerId", event.target.value || null)
              }
            >
              <option value="">— Tidak ada —</option>
              {managers
                .filter((manager) => manager.id !== initial?.id)
                .map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.fullName} · {manager.position}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="lbl">Tanggal bergabung *</label>
            <input
              className="inp"
              data-employee-field="joinedAt"
              type="date"
              value={form.joinedAt}
              onChange={(event) => set("joinedAt", event.target.value)}
            />
            <FieldError message={errors.joinedAt} />
          </div>
          <div>
            <label className="lbl">Jenis hubungan kerja</label>
            {initial ? (
              <>
                <input
                  className="inp"
                  data-employee-field="employmentType"
                  value={form.employmentType}
                  disabled
                />
                <div className="text-[11px] sub mt-1">
                  Hanya bisa diubah lewat modul Kontrak &amp; Masa Kerja.
                </div>
              </>
            ) : (
              <>
                <select
                  className="inp"
                  data-employee-field="employmentType"
                  value={form.employmentType}
                  onChange={(event) =>
                    set(
                      "employmentType",
                      event.target.value as EmploymentType
                    )
                  }
                >
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <div className="text-[11px] sub mt-1">
                  Nilai awal sebelum kontrak pertama dibuat.
                </div>
              </>
            )}
          </div>
          <div>
            <label className="lbl">Status</label>
            <select
              className="inp"
              data-employee-field="status"
              value={form.status}
              onChange={(event) =>
                set("status", event.target.value as EmployeeStatus)
              }
            >
              {EMPLOYEE_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="font-bold text-[13px] mb-3">Kontak</div>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="lbl">Email pribadi *</label>
            <input
              className="inp"
              data-employee-field="personalEmail"
              type="email"
              value={form.personalEmail}
              onChange={(event) => set("personalEmail", event.target.value)}
            />
            <FieldError message={errors.personalEmail} />
          </div>
          <div>
            <label className="lbl">Email kerja *</label>
            <input
              className="inp"
              data-employee-field="workEmail"
              type="email"
              value={form.workEmail}
              onChange={(event) => set("workEmail", event.target.value)}
            />
            <FieldError message={errors.workEmail} />
          </div>
          <div>
            <label className="lbl">Nomor HP *</label>
            <input
              className="inp"
              data-employee-field="phone"
              value={form.phone}
              onChange={(event) => set("phone", event.target.value)}
            />
            <FieldError message={errors.phone} />
          </div>
          <div>
            <label className="lbl">Nama kontak darurat *</label>
            <input
              className="inp"
              data-employee-field="emergencyName"
              value={form.emergencyName}
              onChange={(event) => set("emergencyName", event.target.value)}
            />
            <FieldError message={errors.emergencyName} />
          </div>
          <div>
            <label className="lbl">Hubungan keluarga *</label>
            <input
              className="inp"
              data-employee-field="emergencyRelation"
              placeholder="cth. Istri, Ayah"
              value={form.emergencyRelation}
              onChange={(event) =>
                set("emergencyRelation", event.target.value)
              }
            />
            <FieldError message={errors.emergencyRelation} />
          </div>
          <div>
            <label className="lbl">Nomor kontak darurat *</label>
            <input
              className="inp"
              data-employee-field="emergencyPhone"
              value={form.emergencyPhone}
              onChange={(event) => set("emergencyPhone", event.target.value)}
            />
            <FieldError message={errors.emergencyPhone} />
          </div>
        </div>

        <div className="font-bold text-[13px] mb-3">Probation</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="lbl">Mulai probation</label>
            <input
              className="inp"
              data-employee-field="probationStart"
              type="date"
              value={form.probationStart ?? ""}
              onChange={(event) =>
                set("probationStart", event.target.value || null)
              }
            />
            <FieldError message={errors.probationStart} />
          </div>
          <div>
            <label className="lbl">Berakhir probation</label>
            <input
              className="inp"
              data-employee-field="probationEnd"
              type="date"
              value={form.probationEnd ?? ""}
              onChange={(event) =>
                set("probationEnd", event.target.value || null)
              }
            />
            <FieldError message={errors.probationEnd} />
          </div>
        </div>
      </FormDrawer>

      {discardOpen && open && (
        <div className="rl">
          <ConfirmDialog
            title="Buang perubahan?"
            description="Isian yang sudah diubah dan belum disimpan akan hilang."
            confirmLabel="Ya, buang"
            danger
            busy={false}
            onClose={() => setDiscardOpen(false)}
            onConfirm={() => {
              setDiscardOpen(false);
              onClose();
            }}
          />
        </div>
      )}
    </>
  );
}
