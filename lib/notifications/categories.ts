export const NOTIFICATION_CATEGORIES = [
  {
    key: "leave_pending",
    label: "Cuti & izin menunggu",
    description: "Pengajuan cuti/izin yang menunggu persetujuan HR.",
  },
  {
    key: "overtime_pending",
    label: "Lembur menunggu",
    description: "Pengajuan lembur yang menunggu persetujuan HR.",
  },
  {
    key: "contracts_expiring",
    label: "Kontrak akan berakhir",
    description: "Kontrak aktif yang berakhir dalam 30 hari.",
  },
  {
    key: "documents_expiring",
    label: "Dokumen diperbarui",
    description: "Dokumen karyawan yang habis atau sudah kedaluwarsa.",
  },
  {
    key: "performance_reviews_pending",
    label: "Review kinerja menunggu",
    description: "Lembar penilaian berstatus Dikirim yang menunggu HR.",
  },
  {
    key: "performance_period_overdue",
    label: "Periode penilaian lewat batas",
    description: "Periode Terbuka yang melewati batas pengisian.",
  },
  {
    key: "payroll_unpaid",
    label: "Payroll belum dibayar",
    description: "Run payroll Draft atau Final yang belum dibayar.",
  },
  {
    key: "applicants_new_24h",
    label: "Pelamar baru",
    description: "Pelamar yang masuk dalam 24 jam terakhir.",
  },
  {
    key: "interviews_today",
    label: "Wawancara hari ini",
    description: "Wawancara yang dijadwalkan hari ini.",
  },
  {
    key: "performance_reviews_to_fill",
    label: "Penilaian tim perlu diisi",
    description: "Lembar bawahan yang ditugaskan kepada Anda.",
  },
  {
    key: "my_leave_decisions",
    label: "Keputusan cuti/izin",
    description: "Keputusan cuti atau izin Anda dalam 7 hari terakhir.",
  },
  {
    key: "my_overtime_decisions",
    label: "Keputusan lembur",
    description: "Keputusan lembur Anda dalam 7 hari terakhir.",
  },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["key"];
export type NotificationCategoryDefinition =
  (typeof NOTIFICATION_CATEGORIES)[number];

export function notificationCategoryDefinition(
  category: string
): NotificationCategoryDefinition | null {
  return (
    NOTIFICATION_CATEGORIES.find((item) => item.key === category) ?? null
  );
}

export function notificationCategoryLabel(category: string): string {
  return notificationCategoryDefinition(category)?.label ?? category;
}
