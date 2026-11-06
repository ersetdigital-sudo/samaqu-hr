"use client";

import { useEffect, useState } from "react";
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
      {message}
    </div>
  );
}

export function EmployeeModal({
  open,
  initial,
  nextId,
  managers,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: EmployeeDetail | null;
  nextId: string;
  managers: EmployeeSummary[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<EmployeeInput>(emptyForm);
  const [errors, setErrors] = useState<EmployeeErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? toInput(initial) : emptyForm());
    setErrors({});
    setFormError(null);
    setSaving(false);
  }, [open, initial]);

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
          body: JSON.stringify(payload),
        }
      );

      const data = (await response.json()) as {
        error?: string;
        errors?: EmployeeErrors;
      };

      if (!response.ok) {
        if (data.errors) setErrors(data.errors);
        throw new Error(data.error ?? "Gagal menyimpan data karyawan");
      }

      onSaved(
        initial ? "Data karyawan diperbarui" : "Karyawan baru ditambahkan"
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menyimpan data karyawan"
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal show"
      id="empModal"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="card w-full max-w-[820px] shadow-xl">
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: "var(--line)" }}
        >
          <div>
            <div className="font-bold text-[17px]">
              {initial ? "Edit Data Karyawan" : "Tambah Karyawan"}
            </div>
            <div className="sub text-[13px]">
              Employee ID dibuat otomatis oleh sistem dan dipakai seluruh modul
              HRIS.
            </div>
          </div>
          <button className="btn btn-g !px-3" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="p-6">
          {formError && (
            <div
              className="mb-4 p-3 rounded-xl text-[12px]"
              style={{ background: "var(--badb)", color: "var(--bad)" }}
            >
              {formError}
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
                value={form.fullName}
                onChange={(event) => set("fullName", event.target.value)}
              />
              <FieldError message={errors.fullName} />
            </div>
            <div>
              <label className="lbl">Jenis kelamin</label>
              <select
                className="inp"
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
                value={form.birthPlace}
                onChange={(event) => set("birthPlace", event.target.value)}
              />
              <FieldError message={errors.birthPlace} />
            </div>
            <div>
              <label className="lbl">Tanggal lahir *</label>
              <input
                className="inp"
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
                value={form.position}
                onChange={(event) => set("position", event.target.value)}
              />
              <FieldError message={errors.position} />
            </div>
            <div>
              <label className="lbl">Departemen *</label>
              <select
                className="inp"
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
                  <input className="inp" value={form.employmentType} disabled />
                  <div className="text-[11px] sub mt-1">
                    Hanya bisa diubah lewat modul Kontrak &amp; Masa Kerja.
                  </div>
                </>
              ) : (
                <>
                  <select
                    className="inp"
                    value={form.employmentType}
                    onChange={(event) =>
                      set("employmentType", event.target.value as EmploymentType)
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
                value={form.phone}
                onChange={(event) => set("phone", event.target.value)}
              />
              <FieldError message={errors.phone} />
            </div>
            <div>
              <label className="lbl">Nama kontak darurat *</label>
              <input
                className="inp"
                value={form.emergencyName}
                onChange={(event) => set("emergencyName", event.target.value)}
              />
              <FieldError message={errors.emergencyName} />
            </div>
            <div>
              <label className="lbl">Hubungan keluarga *</label>
              <input
                className="inp"
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
                type="date"
                value={form.probationEnd ?? ""}
                onChange={(event) =>
                  set("probationEnd", event.target.value || null)
                }
              />
              <FieldError message={errors.probationEnd} />
            </div>
          </div>
        </div>

        <div
          className="flex justify-end gap-2 px-6 py-4 border-t"
          style={{
            borderColor: "var(--line)",
            background: "#FCFBFA",
            borderRadius: "0 0 14px 14px",
          }}
        >
          <button className="btn btn-g" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button
            className="btn btn-p"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
