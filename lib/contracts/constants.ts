/** Konstanta kontrak terpusat — jangan hardcode string ini di komponen. */

/** Status tersimpan (lifecycle). */
export const CONTRACT_STATUSES = ["Aktif", "Berakhir", "Diperpanjang"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/**
 * Status tampilan: menambahkan "Akan Berakhir" yang diturunkan dari tanggal
 * berakhir (bukan disimpan), supaya data tetap satu sumber.
 */
export const CONTRACT_DISPLAY_STATUSES = [
  "Aktif",
  "Akan Berakhir",
  "Berakhir",
  "Diperpanjang",
] as const;
export type ContractDisplayStatus =
  (typeof CONTRACT_DISPLAY_STATUSES)[number];

export const CONTRACT_EVENTS = [
  "Dibuat",
  "Diubah",
  "Diperpanjang",
  "Diakhiri",
] as const;
export type ContractEvent = (typeof CONTRACT_EVENTS)[number];

/** Ambang "akan berakhir" dan rentang pantau pada ringkasan. */
export const EXPIRING_SOON_DAYS = 30;
export const EXPIRING_WATCH_DAYS = 90;

export const CONTRACT_STATUS_TONES: Record<ContractDisplayStatus, string> = {
  Aktif: "t-ok",
  "Akan Berakhir": "t-warn",
  Berakhir: "t-bad",
  Diperpanjang: "t-info",
};

export const contractStatusTone = (status: ContractDisplayStatus) =>
  CONTRACT_STATUS_TONES[status] ?? "t-mute";
