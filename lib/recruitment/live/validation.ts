import {
  AVAILABILITIES,
  EDUCATIONS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LENGTHS,
  SKILLS,
  SOURCES,
  type FieldErrors,
  type JobStatus,
} from "@/lib/recruitment/live/types";

export const recordOf = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const choice = (value: unknown, values: readonly string[]) =>
  typeof value === "string" && values.includes(value);
export const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
    .replace(/-$/, "");
export function jakartaDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export const effectiveStatus = (
  status: JobStatus,
  closesAt: string | null,
  now = new Date(),
): JobStatus =>
  status === "Aktif" && closesAt !== null && closesAt < jakartaDate(now)
    ? "Ditutup"
    : status;
export function normalizeWhatsapp(value: string): string {
  const digits = value.replace(/[\s()+-]/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits.startsWith("62") ? digits : `62${digits}`;
}
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
function field(
  errors: FieldErrors,
  input: Record<string, unknown>,
  key: string,
  label: string,
  max: number,
  required = true,
) {
  const value = input[key];
  if (required && !text(value)) errors[key] = `${label} wajib diisi`;
  else if (value != null && typeof value !== "string")
    errors[key] = `${label} tidak valid`;
  else if (text(value).length > max)
    errors[key] = `${label} maksimal ${max} karakter`;
}
export function validateJob(value: unknown): FieldErrors {
  const input = recordOf(value);
  const errors: FieldErrors = {};
  field(errors, input, "title", "Nama posisi", 120);
  field(errors, input, "department", "Divisi", 100);
  field(errors, input, "location", "Lokasi kerja", 200);
  field(errors, input, "summary", "Deskripsi singkat", 200);
  if (
    typeof input.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) ||
    input.slug.length > 120
  )
    errors.slug = "Gunakan huruf kecil, angka, dan tanda hubung";
  if (!choice(input.employment_type, EMPLOYMENT_TYPES))
    errors.employment_type = "Pilih tipe kerja";
  if (
    !Number.isInteger(input.headcount) ||
    Number(input.headcount) < 1 ||
    Number(input.headcount) > 10000
  )
    errors.headcount = "Jumlah dibutuhkan harus 1–10.000";
  if (!choice(input.status, ["Draf", "Aktif", "Ditutup"]))
    errors.status = "Status tidak valid";
  if (
    input.closes_at !== null &&
    input.closes_at !== "" &&
    !validDate(input.closes_at)
  )
    errors.closes_at = "Tanggal tutup tidak valid";
  for (const key of ["duties", "qualifications"]) {
    const values = input[key];
    if (
      !Array.isArray(values) ||
      values.length < 1 ||
      values.length > 8 ||
      values.some(
        (v) => typeof v !== "string" || !v.trim() || v.trim().length > 500,
      )
    )
      errors[key] = "Isi 1–8 poin, maksimal 500 karakter per poin";
  }
  return errors;
}
export function validateApplicationContact(value: unknown): FieldErrors {
  const input = recordOf(value);
  const errors: FieldErrors = {};
  field(errors, input, "full_name", "Nama lengkap", 150);
  field(errors, input, "city", "Kota", 100);
  if (
    typeof input.whatsapp !== "string" ||
    !/^628\d{7,11}$/.test(normalizeWhatsapp(input.whatsapp))
  )
    errors.whatsapp = "Isi nomor WhatsApp Indonesia yang valid";
  if (
    typeof input.email !== "string" ||
    input.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
  )
    errors.email = "Isi alamat email yang valid";
  return errors;
}
export function validateApplicationStep(
  value: unknown,
  step: number,
): FieldErrors {
  const input = recordOf(value);
  const errors: FieldErrors = {};
  if (step === 1) {
    field(errors, input, "full_name", "Nama lengkap", 150);
    field(errors, input, "city", "Domisili", 100);
    if (
      typeof input.whatsapp !== "string" ||
      !/^628\d{7,11}$/.test(normalizeWhatsapp(input.whatsapp))
    )
      errors.whatsapp = "Isi nomor WhatsApp Indonesia yang valid";
    if (
      typeof input.email !== "string" ||
      input.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
    )
      errors.email = "Isi alamat email yang valid";
    if (
      !validDate(input.birth_date) ||
      input.birth_date >= jakartaDate() ||
      input.birth_date < "1900-01-01"
    )
      errors.birth_date = "Isi tanggal lahir yang valid";
    if (!choice(input.education, EDUCATIONS))
      errors.education = "Pilih pendidikan terakhir";
  }
  if (step === 2) {
    if (typeof input.has_admin_experience !== "boolean")
      errors.has_admin_experience = "Pilih pengalaman kamu";
    if (input.has_admin_experience === true) {
      field(errors, input, "last_position", "Posisi terakhir", 150);
      field(errors, input, "last_company", "Tempat kerja", 150);
      if (!choice(input.experience_length, EXPERIENCE_LENGTHS))
        errors.experience_length = "Pilih lama bekerja";
    }
    if (
      !Array.isArray(input.skills) ||
      input.skills.length > SKILLS.length ||
      input.skills.some((v) => !choice(v, SKILLS)) ||
      new Set(input.skills).size !== input.skills.length
    )
      errors.skills = "Pilihan aplikasi tidak valid";
    if (
      typeof input.expected_salary !== "number" ||
      !Number.isFinite(input.expected_salary) ||
      input.expected_salary < 0 ||
      input.expected_salary > 1000000000 ||
      !Number.isInteger(input.expected_salary)
    )
      errors.expected_salary = "Isi ekspektasi gaji yang valid";
    if (!choice(input.start_availability, AVAILABILITIES))
      errors.start_availability = "Pilih kapan kamu bisa mulai";
  }
  if (step === 3) {
    if (input.source !== "" && !choice(input.source, SOURCES))
      errors.source = "Pilih sumber info yang valid";
    field(errors, input, "portfolio_url", "Link portofolio", 2000, false);
    if (text(input.portfolio_url)) {
      try {
        const url = new URL(text(input.portfolio_url));
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          errors.portfolio_url = "Gunakan link http atau https yang valid";
      } catch {
        errors.portfolio_url = "Gunakan link http atau https yang valid";
      }
    }
    field(errors, input, "motivation", "Alasan melamar", 2000, false);
    if (input.consent !== true)
      errors.consent = "Persetujuan pemrosesan data wajib dicentang";
  }
  return errors;
}
