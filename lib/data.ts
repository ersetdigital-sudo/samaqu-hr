export type IconName =
  | "home"
  | "grid"
  | "job"
  | "users"
  | "pipe"
  | "cal"
  | "onb"
  | "rep"
  | "plus"
  | "file"
  | "clock"
  | "vid"
  | "book"
  | "bookSpine"
  | "search"
  | "wallet"
  | "target"
  | "settings"
  | "panel"
  | "chevron"
  | "logout";

export const STAGES = [
  "Lamaran Masuk",
  "Screening",
  "Wawancara",
  "Tes",
  "Offering",
  "Diterima",
  "Ditolak",
];

const STAGE_TONES: Record<string, string> = {
  Aktif: "t-ok",
  Draf: "t-mute",
  Ditutup: "t-bad",
  "Lamaran Masuk": "t-mute",
  Screening: "t-info",
  Wawancara: "t-pink",
  Tes: "t-warn",
  Offering: "t-warn",
  Diterima: "t-ok",
  Ditolak: "t-bad",
  Terkonfirmasi: "t-ok",
  Menunggu: "t-warn",
  Selesai: "t-mute",
  "Dijadwalkan Ulang": "t-info",
};

export const stageTone = (stage: string) => STAGE_TONES[stage] || "t-mute";

export const ini = (name: string) => {
  const words = name.split(" ");
  return (
    words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)
  ).toUpperCase();
};

export const RATING_KEYS = [
  "Komunikasi",
  "Kompetensi Teknis",
  "Problem Solving",
  "Kesesuaian Budaya",
  "Inisiatif",
] as const;

export type RatingKey = (typeof RATING_KEYS)[number];

export const RATING_INIT: Record<RatingKey, number> = {
  Komunikasi: 4,
  "Kompetensi Teknis": 4,
  "Problem Solving": 3,
  "Kesesuaian Budaya": 5,
  Inisiatif: 4,
};

export type OnboardingRow = {
  n: string;
  p: string;
  start: string;
  pic: string;
  pr: number;
};

export const ONB: OnboardingRow[] = [
  { n: "Maya Anjani", p: "Customer Service Specialist", start: "1 Nov 2026", pic: "Ardo", pr: 72 },
  { n: "Nanda Rizky", p: "Digital Marketing Executive", start: "3 Nov 2026", pic: "Sari Wulandari", pr: 45 },
  { n: "Putra Aditya", p: "Supervisor Produksi", start: "14 Okt 2026", pic: "Dewi Kurnia", pr: 90 },
  { n: "Rahma Fitri", p: "Admin Gudang", start: "7 Okt 2026", pic: "Ardo", pr: 100 },
];

export type TodoItem = {
  group: string;
  label: string;
  done: boolean;
};

export const TODO_INIT: TodoItem[] = [
  { group: "Dokumen", label: "KTP & NPWP", done: true },
  { group: "Dokumen", label: "Ijazah & transkrip", done: true },
  { group: "Dokumen", label: "Rekening bank", done: true },
  { group: "Dokumen", label: "Kontrak kerja ditandatangani", done: false },
  { group: "Tugas", label: "Akun email & sistem internal", done: true },
  { group: "Tugas", label: "Perkenalan tim & buddy", done: false },
  { group: "Tugas", label: "Briefing SOP divisi", done: false },
];

export const TRAINING = [
  ["Pengenalan Perusahaan SAMAQU", "Wajib · 30 mnt", 100],
  ["SOP Pelayanan Pelanggan", "Wajib · 45 mnt", 60],
  ["Katalog & Pengetahuan Produk", "Wajib · 60 mnt", 20],
  ["Keamanan Data & Kerahasiaan", "Wajib · 20 mnt", 0],
] as const;

export type Article = {
  title: string;
  category: string;
  author: string;
  updated: string;
  read: string;
  views: number;
};

export const KH: Article[] = [
  { title: "Panduan Produk SAMAQU 2026", category: "Produk", author: "Ardo", updated: "2 hari lalu", read: "12 mnt", views: 1240 },
  { title: "SOP Pelayanan Pelanggan", category: "SOP", author: "Sari Wulandari", updated: "3 hari lalu", read: "8 mnt", views: 980 },
  { title: "Alur Retur & Komplain", category: "SOP", author: "Dewi Kurnia", updated: "1 minggu lalu", read: "6 mnt", views: 642 },
  { title: "Katalog Varian & Harga", category: "Produk", author: "Ardo", updated: "1 minggu lalu", read: "10 mnt", views: 1530 },
  { title: "Kebijakan Cuti & Kehadiran", category: "Kebijakan", author: "Ardo", updated: "2 minggu lalu", read: "5 mnt", views: 410 },
  { title: "Keamanan Data & Kerahasiaan", category: "Kebijakan", author: "Arif Rahman", updated: "3 minggu lalu", read: "7 mnt", views: 388 },
  { title: "Pengenalan Perusahaan", category: "Onboarding", author: "Ardo", updated: "1 bulan lalu", read: "15 mnt", views: 876 },
  { title: "Standar Konten Media Sosial", category: "Marketing", author: "Sari Wulandari", updated: "1 bulan lalu", read: "9 mnt", views: 512 },
];

export type KnowledgeCategory = {
  label: string;
  description: string;
  count: number;
};

export const KHC: KnowledgeCategory[] = [
  { label: "Produk", description: "Spesifikasi, katalog, dan FAQ produk", count: 24 },
  { label: "SOP", description: "Prosedur kerja tiap divisi", count: 38 },
  { label: "Onboarding", description: "Materi wajib karyawan baru", count: 12 },
  { label: "Kebijakan", description: "Aturan dan kebijakan perusahaan", count: 16 },
  { label: "Marketing", description: "Brand, konten, dan kampanye", count: 19 },
];
