import type { InterviewSchedule } from "./types";
import { formatClockID, formatLongDateID } from "@/lib/datetime";

export const formatInterviewDate = (value: string) => formatLongDateID(value);

export const formatInterviewTime = (value: string) => formatClockID(value);

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
