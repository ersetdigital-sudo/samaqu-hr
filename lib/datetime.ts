/**
 * Format tanggal & jam aplikasi.
 *
 * Semua output dipatok ke Asia/Jakarta dan tidak memakai zona waktu runtime,
 * sehingga render server dan browser selalu menghasilkan teks yang sama.
 */

export const APP_TIME_ZONE = "Asia/Jakarta";

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

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type JakartaParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
};

const toDate = (value: Date | string) =>
  value instanceof Date ? value : new Date(value);

const jakartaParts = (date: Date): JakartaParts | null => {
  if (Number.isNaN(date.getTime())) return null;
  const parts = partsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
};

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** "13 Nov 2026" — tanggal polos tidak digeser zona waktu. */
export function formatDateID(value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && isIsoDate(value)) {
    const [year, month, day] = value.split("-");
    return `${day} ${MONTHS_SHORT[Number(month) - 1]} ${year}`;
  }
  const parts = jakartaParts(toDate(value));
  if (!parts) return "—";
  return `${parts.day} ${MONTHS_SHORT[Number(parts.month) - 1]} ${parts.year}`;
}

/** "09:41" WIB. */
export function formatClockID(value: Date | string): string {
  const parts = jakartaParts(toDate(value));
  return parts ? `${parts.hour}:${parts.minute}` : "—";
}

/** "09:41:07" WIB — jam berjalan di halaman Absensi. */
export function formatClockSecondsID(value: Date | string): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** "13 Nov 2026, 09:41" WIB. */
export function formatDateTimeID(
  value: Date | string | null | undefined
): string {
  if (value === null || value === undefined || value === "") return "—";
  return `${formatDateID(value)}, ${formatClockID(value)}`;
}

/** "Kam, 13 Nov" WIB. */
export function formatWeekdayDateID(value: Date | string): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/** "Kamis, 13 November 2026" WIB. */
export function formatLongDateID(value: Date | string): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "November 2026" WIB. */
export function formatMonthYearID(value: Date | string): string {
  const parts = jakartaParts(toDate(value));
  if (!parts) return "—";
  return `${MONTHS_FULL[Number(parts.month) - 1]} ${parts.year}`;
}

/** "2 jam lalu", "Kemarin", "3 hari lalu" — hari kalender WIB. */
export function formatRelativeID(date: Date, now: Date = new Date()): string {
  const dayIndex = (value: Date) => {
    const parts = jakartaParts(value);
    if (!parts) return NaN;
    return (
      Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) /
      DAY_MS
    );
  };
  const dayDiff = dayIndex(now) - dayIndex(date);
  if (dayDiff <= 0) {
    const minutes = Math.max(
      0,
      Math.floor((now.getTime() - date.getTime()) / MINUTE_MS)
    );
    if (minutes < 1) return "baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    return `${Math.floor(minutes / 60)} jam lalu`;
  }
  if (dayDiff === 1) return "Kemarin";
  return `${dayDiff} hari lalu`;
}

/** "HARI INI" / "BESOK" / "KAM 5" — WIB. */
export function formatDayLabelID(date: Date, now: Date): string {
  const parts = jakartaParts(date);
  const today = jakartaParts(now);
  if (!parts || !today) return "—";
  const index = (value: JakartaParts) =>
    Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)) /
    DAY_MS;
  const diff = index(parts) - index(today);
  if (diff === 0) return "HARI INI";
  if (diff === 1) return "BESOK";
  const day = new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
  })
    .format(date)
    .toUpperCase();
  return `${day} ${Number(parts.day)}`;
}

/** Awal hari kalender WIB sebagai Date absolut. */
export function startOfJakartaDay(value: Date = new Date()): Date {
  const parts = jakartaParts(value);
  if (!parts) return value;
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+07:00`);
}

/** "2026-11-10" — tanggal kalender WIB untuk nama berkas. */
export function isoDateJakarta(value: Date = new Date()): string {
  const parts = jakartaParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
}
