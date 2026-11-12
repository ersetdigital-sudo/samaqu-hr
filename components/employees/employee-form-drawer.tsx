"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { FormDrawer } from "@/components/ui/form-drawer";
import {
  FormField,
  FormGrid,
  FormInfoStrip,
  FormSection,
  FormSectionNav,
  FormUnsavedIndicator,
} from "@/components/ui/form-section";
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
  "nik",
  "address",
  "personalEmail",
  "workEmail",
  "phone",
  "emergencyPhone",
  "position",
  "department",
  "location",
  "joinedAt",
  "probationStart",
  "probationEnd",
  "emergencyName",
  "emergencyRelation",
];

const FORM_SECTIONS: {
  id: string;
  label: string;
  fields: (keyof EmployeeInput)[];
}[] = [
  {
    id: "employee-identitas",
    label: "Identitas",
    fields: ["fullName", "birthPlace", "birthDate", "nik", "address"],
  },
  {
    id: "employee-kontak",
    label: "Kontak",
    fields: ["personalEmail", "workEmail", "phone", "emergencyPhone"],
  },
  {
    id: "employee-pekerjaan",
    label: "Pekerjaan",
    fields: ["position", "department", "location", "joinedAt"],
  },
  {
    id: "employee-probation",
    label: "Probation",
    fields: ["probationStart", "probationEnd"],
  },
  {
    id: "employee-kontak-darurat",
    label: "Kontak Darurat",
    fields: ["emergencyName", "emergencyRelation"],
  },
];

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
  const [activeSection, setActiveSection] = useState(FORM_SECTIONS[0].id);
  const baselineRef = useRef<EmployeeInput | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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
    setActiveSection(FORM_SECTIONS[0].id);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [open, initial, initialInput]);

  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    if (!root) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rootTop = root.getBoundingClientRect().top;
      let current = FORM_SECTIONS[0].id;

      for (const section of FORM_SECTIONS) {
        const element = root.querySelector<HTMLElement>(
          `[data-form-section="${section.id}"]`
        );
        if (!element) continue;
        if (element.getBoundingClientRect().top - rootTop <= 20) {
          current = section.id;
        }
      }

      if (
        root.scrollHeight > root.clientHeight + 2 &&
        root.scrollTop + root.clientHeight >= root.scrollHeight - 2
      ) {
        current = FORM_SECTIONS[FORM_SECTIONS.length - 1].id;
      }

      setActiveSection((previous) =>
        previous === current ? previous : current
      );
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [open]);

  const scrollToSection = (id: string) => {
    const root = scrollRef.current;
    if (!root) return;
    const element = root.querySelector<HTMLElement>(
      `[data-form-section="${id}"]`
    );
    if (!element) return;

    setActiveSection(id);
    const top =
      root.scrollTop +
      element.getBoundingClientRect().top -
      root.getBoundingClientRect().top -
      10;

    root.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  const navItems = FORM_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    error: section.fields.some((field) => Boolean(errors[field])),
  }));

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
        footerStatus={dirty ? <FormUnsavedIndicator /> : null}
        bodyRef={scrollRef}
        subnav={
          <FormSectionNav
            items={navItems}
            activeId={activeSection}
            onSelect={scrollToSection}
          />
        }
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

        <div className="flex flex-col gap-4 mt-4">
          <FormInfoStrip
            label="Employee ID"
            value={initial ? initial.id : nextId}
            hint="Dibuat otomatis oleh sistem dan tidak bisa diubah manual."
          />

          <FormSection
            sectionId="employee-identitas"
            icon="users"
            title="Identitas"
            description="Data diri sesuai dokumen resmi."
          >
            <FormGrid>
              <FormField
                label="Nama lengkap"
                required
                error={errors.fullName}
              >
                <input
                  className="inp"
                  data-employee-field="fullName"
                  aria-invalid={Boolean(errors.fullName)}
                  placeholder="cth. Salsabila Putri"
                  value={form.fullName}
                  onChange={(event) => set("fullName", event.target.value)}
                />
              </FormField>

              <FormField label="Jenis kelamin" span="half">
                <select
                  className="inp"
                  data-employee-field="gender"
                  value={form.gender}
                  onChange={(event) =>
                    set("gender", event.target.value as Gender)
                  }
                >
                  {GENDERS.map((gender) => (
                    <option key={gender}>{gender}</option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Tempat lahir"
                required
                span="half"
                error={errors.birthPlace}
              >
                <input
                  className="inp"
                  data-employee-field="birthPlace"
                  aria-invalid={Boolean(errors.birthPlace)}
                  placeholder="cth. Bandung"
                  value={form.birthPlace}
                  onChange={(event) => set("birthPlace", event.target.value)}
                />
              </FormField>

              <FormField
                label="Tanggal lahir"
                required
                span="half"
                error={errors.birthDate}
              >
                <input
                  className="inp"
                  data-employee-field="birthDate"
                  aria-invalid={Boolean(errors.birthDate)}
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => set("birthDate", event.target.value)}
                />
              </FormField>

              <FormField
                label="NIK KTP"
                required
                span="half"
                error={errors.nik}
                hint="Hanya tampil di detail identitas untuk role berhak."
              >
                <input
                  className="inp"
                  data-employee-field="nik"
                  aria-invalid={Boolean(errors.nik)}
                  inputMode="numeric"
                  maxLength={16}
                  placeholder="16 digit angka"
                  value={form.nik}
                  onChange={(event) => set("nik", event.target.value)}
                />
              </FormField>

              <FormField label="Alamat" required error={errors.address}>
                <textarea
                  className="inp"
                  data-employee-field="address"
                  aria-invalid={Boolean(errors.address)}
                  rows={2}
                  placeholder="cth. Jl. Merdeka No. 10, Bandung"
                  value={form.address}
                  onChange={(event) => set("address", event.target.value)}
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            sectionId="employee-kontak"
            icon="mail"
            title="Kontak"
            description="Email dan nomor yang bisa dihubungi."
          >
            <FormGrid>
              <FormField
                label="Email pribadi"
                required
                span="half"
                error={errors.personalEmail}
              >
                <input
                  className="inp"
                  data-employee-field="personalEmail"
                  aria-invalid={Boolean(errors.personalEmail)}
                  type="email"
                  placeholder="nama@email.com"
                  value={form.personalEmail}
                  onChange={(event) =>
                    set("personalEmail", event.target.value)
                  }
                />
              </FormField>

              <FormField
                label="Email kerja"
                required
                span="half"
                error={errors.workEmail}
              >
                <input
                  className="inp"
                  data-employee-field="workEmail"
                  aria-invalid={Boolean(errors.workEmail)}
                  type="email"
                  placeholder="nama@samaqu.id"
                  value={form.workEmail}
                  onChange={(event) => set("workEmail", event.target.value)}
                />
              </FormField>

              <FormField
                label="Nomor HP"
                required
                span="half"
                error={errors.phone}
              >
                <input
                  className="inp"
                  data-employee-field="phone"
                  aria-invalid={Boolean(errors.phone)}
                  placeholder="cth. 0812 3456 7890"
                  value={form.phone}
                  onChange={(event) => set("phone", event.target.value)}
                />
              </FormField>

              <FormField
                label="Nomor kontak darurat"
                required
                span="half"
                error={errors.emergencyPhone}
              >
                <input
                  className="inp"
                  data-employee-field="emergencyPhone"
                  aria-invalid={Boolean(errors.emergencyPhone)}
                  placeholder="cth. 0812 3456 7890"
                  value={form.emergencyPhone}
                  onChange={(event) =>
                    set("emergencyPhone", event.target.value)
                  }
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            sectionId="employee-pekerjaan"
            icon="job"
            title="Pekerjaan"
            description="Posisi, penempatan, dan status kepegawaian."
          >
            <FormGrid>
              <FormField
                label="Jabatan"
                required
                error={errors.position}
              >
                <input
                  className="inp"
                  data-employee-field="position"
                  aria-invalid={Boolean(errors.position)}
                  placeholder="cth. Customer Service"
                  value={form.position}
                  onChange={(event) => set("position", event.target.value)}
                />
              </FormField>

              <FormField
                label="Departemen"
                required
                span="half"
                error={errors.department}
              >
                <select
                  className="inp"
                  data-employee-field="department"
                  aria-invalid={Boolean(errors.department)}
                  value={form.department}
                  onChange={(event) => set("department", event.target.value)}
                >
                  {DEPARTMENTS.map((department) => (
                    <option key={department}>{department}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Lokasi kerja" required span="half">
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
              </FormField>

              <FormField label="Atasan langsung">
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
              </FormField>

              <FormField
                label="Tanggal bergabung"
                required
                span="half"
                error={errors.joinedAt}
              >
                <input
                  className="inp"
                  data-employee-field="joinedAt"
                  aria-invalid={Boolean(errors.joinedAt)}
                  type="date"
                  value={form.joinedAt}
                  onChange={(event) => set("joinedAt", event.target.value)}
                />
              </FormField>

              <FormField label="Status" span="half">
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
              </FormField>

              <FormField
                label="Jenis hubungan kerja"
                hint={
                  initial
                    ? "Hanya bisa diubah lewat modul Kontrak & Masa Kerja."
                    : "Nilai awal sebelum kontrak pertama dibuat."
                }
              >
                {initial ? (
                  <input
                    className="inp"
                    data-employee-field="employmentType"
                    value={form.employmentType}
                    disabled
                  />
                ) : (
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
                )}
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            sectionId="employee-probation"
            icon="clock"
            title="Probation"
            description="Masa percobaan karyawan. Isi jika berlaku."
          >
            <FormGrid>
              <FormField
                label="Mulai probation"
                span="half"
                error={errors.probationStart}
              >
                <input
                  className="inp"
                  data-employee-field="probationStart"
                  aria-invalid={Boolean(errors.probationStart)}
                  type="date"
                  value={form.probationStart ?? ""}
                  onChange={(event) =>
                    set("probationStart", event.target.value || null)
                  }
                />
              </FormField>

              <FormField
                label="Berakhir probation"
                span="half"
                error={errors.probationEnd}
              >
                <input
                  className="inp"
                  data-employee-field="probationEnd"
                  aria-invalid={Boolean(errors.probationEnd)}
                  type="date"
                  value={form.probationEnd ?? ""}
                  onChange={(event) =>
                    set("probationEnd", event.target.value || null)
                  }
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            sectionId="employee-kontak-darurat"
            icon="phone"
            title="Kontak Darurat"
            description="Nama dan hubungan orang yang dihubungi saat darurat."
          >
            <FormGrid>
              <FormField
                label="Nama kontak darurat"
                required
                span="half"
                error={errors.emergencyName}
              >
                <input
                  className="inp"
                  data-employee-field="emergencyName"
                  aria-invalid={Boolean(errors.emergencyName)}
                  placeholder="cth. Budi Santoso"
                  value={form.emergencyName}
                  onChange={(event) =>
                    set("emergencyName", event.target.value)
                  }
                />
              </FormField>

              <FormField
                label="Hubungan keluarga"
                required
                span="half"
                error={errors.emergencyRelation}
              >
                <input
                  className="inp"
                  data-employee-field="emergencyRelation"
                  aria-invalid={Boolean(errors.emergencyRelation)}
                  placeholder="cth. Istri, Ayah"
                  value={form.emergencyRelation}
                  onChange={(event) =>
                    set("emergencyRelation", event.target.value)
                  }
                />
              </FormField>
            </FormGrid>
          </FormSection>
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
