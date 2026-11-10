import {
  INTERVIEW_MODES,
  INTERVIEW_RECOMMENDATIONS,
  INTERVIEW_STATUSES,
  type FieldErrors,
  type InterviewEvaluationInput,
  type InterviewInput,
  type InterviewMode,
  type InterviewRecommendation,
  type InterviewStatus,
} from "./types";
import { recordOf } from "./validation";

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const choice = (value: unknown, values: readonly string[]) =>
  typeof value === "string" && values.includes(value);

export function interviewErrors(value: unknown): FieldErrors {
  const input = recordOf(value);
  const errors: FieldErrors = {};

  if (
    typeof input.scheduled_at !== "string" ||
    !Number.isFinite(Date.parse(input.scheduled_at))
  )
    errors.scheduled_at = "Tanggal dan jam wajib diisi dengan benar";

  if (
    !Number.isInteger(input.duration_minutes) ||
    Number(input.duration_minutes) < 15 ||
    Number(input.duration_minutes) > 480
  )
    errors.duration_minutes = "Durasi harus 15–480 menit";

  if (!choice(input.mode, INTERVIEW_MODES))
    errors.mode = "Pilih jenis wawancara";

  const interviewer = text(input.interviewer_name);
  if (!interviewer) errors.interviewer_name = "Nama pewawancara wajib diisi";
  else if (interviewer.length > 150)
    errors.interviewer_name = "Nama pewawancara maksimal 150 karakter";

  const location = text(input.location_or_link);
  if (!location) errors.location_or_link = "Lokasi atau link wajib diisi";
  else if (location.length > 500)
    errors.location_or_link = "Lokasi atau link maksimal 500 karakter";

  if (typeof input.notes === "string" && input.notes.length > 2000)
    errors.notes = "Catatan maksimal 2000 karakter";

  return errors;
}

export function parseInterviewInput(value: unknown): InterviewInput {
  const input = recordOf(value);
  return {
    scheduled_at: new Date(String(input.scheduled_at)).toISOString(),
    duration_minutes: Number(input.duration_minutes),
    mode: input.mode as InterviewMode,
    location_or_link: text(input.location_or_link),
    interviewer_name: text(input.interviewer_name),
    notes: typeof input.notes === "string" ? input.notes.trim() : "",
  };
}

export function evaluationErrors(value: unknown): FieldErrors {
  const input = recordOf(value);
  const errors: FieldErrors = {};
  const scores = [
    ["score_communication", "Komunikasi"],
    ["score_attitude", "Sikap & etika kerja"],
    ["score_skill", "Kemampuan kerja"],
    ["score_team_fit", "Kecocokan dengan tim"],
  ] as const;

  for (const [key, label] of scores) {
    if (
      !Number.isInteger(input[key]) ||
      Number(input[key]) < 1 ||
      Number(input[key]) > 5
    )
      errors[key] = `${label} harus bernilai 1–5`;
  }

  if (!choice(input.recommendation, INTERVIEW_RECOMMENDATIONS))
    errors.recommendation = "Pilih rekomendasi";

  if (typeof input.comments === "string" && input.comments.length > 2000)
    errors.comments = "Catatan evaluasi maksimal 2000 karakter";

  return errors;
}

export function parseEvaluationInput(value: unknown): InterviewEvaluationInput {
  const input = recordOf(value);
  return {
    score_communication: Number(input.score_communication),
    score_attitude: Number(input.score_attitude),
    score_skill: Number(input.score_skill),
    score_team_fit: Number(input.score_team_fit),
    recommendation: input.recommendation as InterviewRecommendation,
    comments:
      typeof input.comments === "string" ? input.comments.trim() : "",
  };
}

export const isInterviewStatus = (value: unknown): value is InterviewStatus =>
  choice(value, INTERVIEW_STATUSES);
