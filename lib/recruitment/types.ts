/**
 * Tipe domain modul Recruitment.
 *
 * Semua bentuk data di sini sengaja dibuat netral terhadap sumber datanya,
 * sehingga bisa dipetakan langsung ke tabel database (jobs, candidates,
 * interviews, activities) tanpa mengubah komponen UI.
 */

export type Job = {
  id: number;
  pos: string;
  dep: string;
  st: string;
  n: number;
  pub: string;
  dl: string;
  /** ISO date. `null` untuk lowongan yang belum pernah dipublikasikan. */
  publishedAt: string | null;
};

export type Candidate = {
  id: number;
  name: string;
  pos: string;
  stage: string;
  note: string;
  score: number | null;
  src: string;
  /** ISO date lamaran masuk. */
  appliedAt: string;
};

export type Interview = {
  id: string;
  /** Label hari, mis. "HARI INI", "BESOK", "KAM 5". */
  d: string;
  /** Jam mulai, mis. "10:00". */
  t: string;
  c: string;
  p: string;
  i: string;
  m: string;
  st: string;
  /** ISO datetime, dipakai untuk pengurutan jadwal terdekat. */
  at: string;
};

export type Activity = {
  id: string;
  actor: string;
  before: string;
  subject: string;
  after: string;
  /** ISO datetime kejadian. */
  at: string;
  /** Label relatif, mis. "2 jam lalu". */
  label: string;
};

export type RecruitmentSnapshot = {
  jobs: Job[];
  candidates: Candidate[];
  interviews: Interview[];
  activities: Activity[];
};

export type StatCard = {
  label: string;
  value: number;
  hint: string;
  highlight?: boolean;
};

export type PipelineMetric = {
  stage: string;
  count: number;
  /** Konversi terhadap tahap sebelumnya, `null` untuk tahap pertama. */
  conversion: number | null;
};

/** Input yang dibutuhkan untuk membuat lowongan baru. */
export type NewJobInput = {
  pos: string;
  dep: string;
  st: "Aktif" | "Draf";
  n?: number;
};
