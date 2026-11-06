/** Helper format tanggal/label yang dipakai lapisan data maupun UI. */

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const MONTHS_FULL = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAYS_SHORT = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

const pad = (value: number) => String(value).padStart(2, "0");

/** "03 Nov 2026" */
export const formatDateID = (date: Date) =>
  `${pad(date.getDate())} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;

/** "10:00" */
export const formatClockID = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** "HARI INI" / "BESOK" / "KAM 5" */
export const formatDayLabelID = (date: Date, now: Date) => {
  const diffDays = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      DAY_MS
  );
  if (diffDays === 0) return "HARI INI";
  if (diffDays === 1) return "BESOK";
  return `${DAYS_SHORT[date.getDay()]} ${date.getDate()}`;
};

/** "2 jam lalu", "Kemarin", "3 hari lalu" */
export const formatRelativeID = (date: Date, now: Date) => {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - date.getTime()) / MINUTE_MS)
  );
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  if (hours < 48) return "Kemarin";
  return `${Math.round(hours / 24)} hari lalu`;
};

/** "November 2026" */
export const formatMonthYearID = (date: Date) =>
  `${MONTHS_FULL[date.getMonth()]} ${date.getFullYear()}`;

/** Awal hari (00:00 waktu lokal), untuk membandingkan "hari ini". */
export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Selisih hari kalender antara dua tanggal. */
export const daysBetween = (from: Date, to: Date) =>
  Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
