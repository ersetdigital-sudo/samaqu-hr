/** Status kedaluwarsa dokumen — dihitung, tidak disimpan. */

export const EXPIRING_SOON_DAYS = 30;

export type DocumentExpiryStatus = "Akan Habis" | "Kedaluwarsa";

const DAY_MS = 86_400_000;

const dayIndex = (iso: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = Date.UTC(year, month - 1, day);
  if (Number.isNaN(date)) return null;
  return date / DAY_MS;
};

/** Selisih hari kalender (validUntil - today); negatif berarti sudah lewat. */
export function daysUntilDate(
  validUntil: string | null | undefined,
  todayIso: string
): number | null {
  if (!validUntil) return null;
  const target = dayIndex(validUntil);
  const today = dayIndex(todayIso);
  if (target === null || today === null) return null;
  return target - today;
}

export function documentExpiryStatus(
  validUntil: string | null | undefined,
  todayIso: string
): DocumentExpiryStatus | null {
  const days = daysUntilDate(validUntil, todayIso);
  if (days === null) return null;
  if (days < 0) return "Kedaluwarsa";
  if (days <= EXPIRING_SOON_DAYS) return "Akan Habis";
  return null;
}

export const documentStatusTone = (
  status: DocumentExpiryStatus
): "t-bad" | "t-warn" => (status === "Kedaluwarsa" ? "t-bad" : "t-warn");
