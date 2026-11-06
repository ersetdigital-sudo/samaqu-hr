/**
 * Dataset awal modul Recruitment.
 *
 * Ini satu-satunya tempat data contoh rekrutmen didefinisikan. Komponen UI
 * tidak boleh lagi memuat angka/hardcode sendiri: semua angka diturunkan dari
 * dataset ini melalui `repository.ts` dan `selectors.ts`.
 *
 * Saat database tersedia, file ini cukup diganti oleh implementasi sumber data
 * di `repository.ts` (lihat komentar di sana). Bentuk recordnya sudah 1:1
 * dengan tabel yang dibutuhkan: jobs, candidates, interviews, activities.
 */

export type JobSeed = {
  id: number;
  pos: string;
  dep: string;
  st: string;
  n: number;
  /** Selisih hari dari hari ini saat lowongan dipublikasikan. */
  publishedDaysAgo: number | null;
  /** Tenggat lamaran, dihitung dari tanggal publikasi. */
  deadlineInDays: number;
};

export type CandidateSeed = {
  name: string;
  pos: string;
  stage: string;
  note: string;
  score: number | null;
  /** Selisih hari sejak lamaran masuk. */
  appliedDaysAgo: number;
};

export type InterviewSeed = {
  c: string;
  p: string;
  i: string;
  m: string;
  st: string;
  /** Selisih jam dari sekarang; negatif berarti sudah lewat. */
  startsInHours: number;
};

export type ActivitySeed = {
  actor: string;
  before: string;
  subject: string;
  after: string;
  /** Selisih menit dari sekarang. */
  minutesAgo: number;
};

export const JOB_SEEDS: JobSeed[] = [
  { id: 1, pos: "Customer Service Specialist", dep: "Customer Service", st: "Aktif", n: 48, publishedDaysAgo: 32, deadlineInDays: 29 },
  { id: 2, pos: "Digital Marketing Executive", dep: "Marketing", st: "Aktif", n: 36, publishedDaysAgo: 29, deadlineInDays: 31 },
  { id: 3, pos: "Admin Gudang", dep: "Operasional", st: "Aktif", n: 29, publishedDaysAgo: 26, deadlineInDays: 31 },
  { id: 4, pos: "Staff Keuangan", dep: "Keuangan", st: "Aktif", n: 22, publishedDaysAgo: 24, deadlineInDays: 31 },
  { id: 5, pos: "Frontend Developer", dep: "Teknologi", st: "Aktif", n: 31, publishedDaysAgo: 22, deadlineInDays: 31 },
  { id: 6, pos: "Content Creator", dep: "Marketing", st: "Draf", n: 0, publishedDaysAgo: null, deadlineInDays: 0 },
  { id: 7, pos: "Supervisor Produksi", dep: "Operasional", st: "Ditutup", n: 20, publishedDaysAgo: 60, deadlineInDays: 29 },
];

export const CANDIDATE_SEEDS: CandidateSeed[] = [
  { name: "Ayu Lestari", pos: "Customer Service Specialist", stage: "Lamaran Masuk", note: "2 jam lalu", score: null, appliedDaysAgo: 0 },
  { name: "Bima Pratama", pos: "Frontend Developer", stage: "Lamaran Masuk", note: "5 jam lalu", score: null, appliedDaysAgo: 0 },
  { name: "Citra Dewi", pos: "Digital Marketing Executive", stage: "Lamaran Masuk", note: "Kemarin", score: null, appliedDaysAgo: 1 },
  { name: "Dimas Saputra", pos: "Admin Gudang", stage: "Screening", note: "Kemarin", score: 78, appliedDaysAgo: 1 },
  { name: "Eka Putri", pos: "Staff Keuangan", stage: "Screening", note: "2 hari lalu", score: 82, appliedDaysAgo: 2 },
  { name: "Fajar Nugroho", pos: "Customer Service Specialist", stage: "Screening", note: "2 hari lalu", score: 71, appliedDaysAgo: 2 },
  { name: "Gita Maharani", pos: "Digital Marketing Executive", stage: "Wawancara", note: "Besok 10:00", score: 85, appliedDaysAgo: 4 },
  { name: "Hendra Wijaya", pos: "Frontend Developer", stage: "Wawancara", note: "Besok 13:30", score: 88, appliedDaysAgo: 4 },
  { name: "Intan Permata", pos: "Customer Service Specialist", stage: "Wawancara", note: "20 Okt 09:00", score: 80, appliedDaysAgo: 5 },
  { name: "Joko Susanto", pos: "Frontend Developer", stage: "Tes", note: "Tes teknis 21 Okt", score: 86, appliedDaysAgo: 7 },
  { name: "Kirana Salsabila", pos: "Staff Keuangan", stage: "Tes", note: "Tes 22 Okt", score: 79, appliedDaysAgo: 8 },
  { name: "Lukman Hakim", pos: "Admin Gudang", stage: "Offering", note: "Menunggu respons", score: 84, appliedDaysAgo: 12 },
  { name: "Maya Anjani", pos: "Customer Service Specialist", stage: "Diterima", note: "Mulai 1 Nov", score: 90, appliedDaysAgo: 20 },
  { name: "Nanda Rizky", pos: "Digital Marketing Executive", stage: "Diterima", note: "Mulai 3 Nov", score: 87, appliedDaysAgo: 21 },
  { name: "Oki Ramadhan", pos: "Admin Gudang", stage: "Ditolak", note: "Tidak lolos tes", score: 62, appliedDaysAgo: 15 },
];

export const CANDIDATE_SOURCES = [
  "JobStreet",
  "LinkedIn",
  "Website",
  "Referral",
  "Glints",
];

export const INTERVIEW_SEEDS: InterviewSeed[] = [
  { c: "Gita Maharani", p: "Digital Marketing Executive", i: "Budi Santoso", m: "Google Meet", st: "Terkonfirmasi", startsInHours: 3 },
  { c: "Hendra Wijaya", p: "Frontend Developer", i: "Arif Rahman", m: "Kantor Pusat", st: "Terkonfirmasi", startsInHours: 6.5 },
  { c: "Intan Permata", p: "Customer Service Specialist", i: "Ardo", m: "Google Meet", st: "Menunggu", startsInHours: 8 },
  { c: "Joko Susanto", p: "Frontend Developer", i: "Arif Rahman", m: "Tes Teknis", st: "Terkonfirmasi", startsInHours: 30 },
  { c: "Kirana Salsabila", p: "Staff Keuangan", i: "Dewi Kurnia", m: "Kantor Pusat", st: "Dijadwalkan Ulang", startsInHours: 54 },
  { c: "Lukman Hakim", p: "Admin Gudang", i: "Ardo", m: "Kantor Pusat", st: "Selesai", startsInHours: -72 },
];

export const ACTIVITY_SEEDS: ActivitySeed[] = [
  { actor: "Ayu Lestari", before: " melamar sebagai ", subject: "Customer Service Specialist", after: "", minutesAgo: 120 },
  { actor: "Ardo", before: " memindahkan ", subject: "Hendra Wijaya", after: " ke Wawancara", minutesAgo: 180 },
  { actor: "Budi S.", before: " mengirim evaluasi untuk ", subject: "Gita Maharani", after: " · Skor 4,3", minutesAgo: 300 },
  { actor: "Ardo", before: " mengirim offering ke ", subject: "Lukman Hakim", after: "", minutesAgo: 1440 },
  { actor: "Sistem", before: " lowongan ", subject: "Supervisor Produksi", after: " ditutup otomatis", minutesAgo: 2880 },
];
