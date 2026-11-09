import { STAGES } from "@/lib/data";

export const APPLICATION_STAGES = STAGES;
export const EMPLOYMENT_TYPES = [
  "Full-time",
  "Kontrak",
  "Magang",
  "Harian",
] as const;
export const EDUCATIONS = ["SMP", "SMA/SMK", "D3", "S1", "Lainnya"] as const;
export const EXPERIENCE_LENGTHS = ["<1 thn", "1–2 thn", ">2 thn"] as const;
export const SKILLS = [
  "Excel / Google Sheets",
  "Shopee / TikTok Seller",
  "WhatsApp Business",
  "Canva",
] as const;
export const AVAILABILITIES = ["Segera", "2 minggu", "1 bulan"] as const;
export const SOURCES = ["Instagram", "WhatsApp", "Teman", "Lainnya"] as const;
export const MAX_CV_BYTES = 2 * 1024 * 1024;
export type JobStatus = "Draf" | "Aktif" | "Ditutup";
export type JobInput = {
  slug: string;
  title: string;
  department: string;
  location: string;
  employment_type: (typeof EMPLOYMENT_TYPES)[number];
  headcount: number;
  summary: string;
  duties: string[];
  qualifications: string[];
  closes_at: string | null;
  status: JobStatus;
};
export type JobPosting = JobInput & {
  id: string;
  published_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type JobSummary = JobPosting & {
  applicant_count: number;
  unreviewed_count: number;
  accepted_count: number;
};
export type PublicJob = Omit<JobPosting, "created_by">;
export type ApplicationInput = {
  full_name: string;
  whatsapp: string;
  email: string;
  birth_date: string;
  city: string;
  education: (typeof EDUCATIONS)[number];
  has_admin_experience: boolean;
  last_position: string;
  last_company: string;
  experience_length: (typeof EXPERIENCE_LENGTHS)[number] | "";
  skills: string[];
  expected_salary: number;
  start_availability: (typeof AVAILABILITIES)[number];
  source: (typeof SOURCES)[number] | "";
  portfolio_url: string;
  motivation: string;
  consent: boolean;
};
export type ApplicationDraft = Omit<
  ApplicationInput,
  | "education"
  | "has_admin_experience"
  | "expected_salary"
  | "start_availability"
> & {
  education: ApplicationInput["education"] | "";
  has_admin_experience: boolean | null;
  expected_salary: number | "";
  start_availability: ApplicationInput["start_availability"] | "";
};
export type JobApplication = Omit<ApplicationInput, "consent"> & {
  id: string;
  job_id: string;
  application_number: string;
  consent_at: string;
  stage: string;
  internal_note: string;
  reviewed_at: string | null;
  rejected_at: string | null;
  cv_deleted_at: string | null;
  /** Terisi setelah pelamar Diterima dikonversi menjadi karyawan. */
  employee_id: string | null;
  created_at: string;
  updated_at: string;
};
export type ApplicationPage = {
  applications: JobApplication[];
  total: number;
  unreviewed: number;
  stage_counts: Record<string, number>;
  page: number;
  page_size: number;
};

/** Data lamaran + lowongan yang aman dipakai untuk mengisi form karyawan. */
export type ApplicationEmployeeSource = {
  applicationId: string;
  fullName: string;
  birthDate: string;
  phone: string;
  email: string;
  position: string;
  department: string;
  location: string;
  employmentType: string;
};

export type CandidateJob = Pick<
  JobPosting,
  | "id"
  | "slug"
  | "title"
  | "status"
  | "closes_at"
  | "closed_at"
  | "published_at"
  | "created_at"
>;

export type CandidateApplication = JobApplication & {
  job: CandidateJob | null;
};

/** Satu snapshot terbatas untuk Kandidat, Pipeline, dan Overview. */
export type RecruitmentBoard = {
  jobs: CandidateJob[];
  applications: CandidateApplication[];
  /** Total pelamar di database, walau snapshot dibatasi. */
  total: number;
  limit: number;
};
export type FieldErrors = Record<string, string>;
