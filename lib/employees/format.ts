/** Helper tanggal untuk modul Employee Management (format input: YYYY-MM-DD). */

import { formatDateID } from "@/lib/recruitment/format";

export const parseIsoDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

/** "2026-11-03" → "03 Nov 2026" */
export const formatIsoDateID = (iso: string | null | undefined): string => {
  const date = parseIsoDate(iso);
  return date ? formatDateID(date) : "—";
};

export const isoFromDate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const isoToday = (): string => isoFromDate(new Date());

export const isoDaysAgo = (days: number, now: Date = new Date()): string =>
  isoFromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));

export const isoDaysAhead = (days: number, now: Date = new Date()): string =>
  isoFromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
