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
  | "logout"
  | "external";

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
  Dijadwalkan: "t-warn",
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
  {
    n: "Maya Anjani",
    p: "Customer Service Specialist",
    start: "1 Nov 2026",
    pic: "Ardo",
    pr: 72,
  },
  {
    n: "Nanda Rizky",
    p: "Digital Marketing Executive",
    start: "3 Nov 2026",
    pic: "Sari Wulandari",
    pr: 45,
  },
  {
    n: "Putra Aditya",
    p: "Supervisor Produksi",
    start: "14 Okt 2026",
    pic: "Dewi Kurnia",
    pr: 90,
  },
  {
    n: "Rahma Fitri",
    p: "Admin Gudang",
    start: "7 Okt 2026",
    pic: "Ardo",
    pr: 100,
  },
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
