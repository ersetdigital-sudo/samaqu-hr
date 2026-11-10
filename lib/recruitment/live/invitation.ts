import type { InterviewSchedule } from "./types";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

export const formatInterviewDate = (value: string) =>
  dateFormatter.format(new Date(value));

export const formatInterviewTime = (value: string) => {
  const parts = timeFormatter.formatToParts(new Date(value));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
};

/** Teks WhatsApp singkat; hanya disalin, tidak dikirim otomatis. */
export function buildInterviewInvitation(interview: InterviewSchedule): string {
  return [
    `Halo ${interview.applicant_name}, kami mengundang Anda untuk wawancara posisi ${interview.job_title} di SAMAQU.`,
    "",
    `Ronde: ${interview.round_number}`,
    `Hari/tanggal: ${formatInterviewDate(interview.scheduled_at)}`,
    `Waktu: ${formatInterviewTime(interview.scheduled_at)} WIB`,
    `Durasi: ${interview.duration_minutes} menit`,
    `Jenis: ${interview.mode}`,
    `Lokasi/Link: ${interview.location_or_link}`,
    `Pewawancara: ${interview.interviewer_name}`,
    "",
    "Mohon konfirmasi kehadiran dengan membalas pesan ini. Terima kasih.",
  ].join("\n");
}
