/**
 * Helper tanggal/label rekrutmen.
 *
 * Implementasi format sebenarnya ada di `lib/datetime` (dipatok Asia/Jakarta)
 * agar tampilan server dan browser selalu sama.
 */

export {
  formatClockID,
  formatDateID,
  formatDateTimeID,
  formatDayLabelID,
  formatLongDateID,
  formatMonthYearID,
  formatRelativeID,
  formatWeekdayDateID,
} from "@/lib/datetime";

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** Awal hari (00:00 waktu lokal), untuk membandingkan "hari ini". */
export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Selisih hari kalender antara dua tanggal. */
export const daysBetween = (from: Date, to: Date) =>
  Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
