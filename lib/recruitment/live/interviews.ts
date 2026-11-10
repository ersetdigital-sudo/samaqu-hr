import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { assertId, RecruitmentError } from "./http";
import type {
  InterviewEvaluationInput,
  InterviewInput,
  InterviewSchedule,
  InterviewStatus,
} from "./types";

const VIEW_COLUMNS =
  "id,application_id,round_number,scheduled_at,duration_minutes,mode,location_or_link,interviewer_name,status,notes,created_at,updated_at,applicant_name,job_id,job_title,evaluation_id,score_communication,score_attitude,score_skill,score_team_fit,recommendation,comments,average_score";

const INTERVIEW_LIMIT = 500;

type ViewRow = InterviewSchedule & {
  average_score: number | string | null;
};

const mapRow = (row: ViewRow): InterviewSchedule => ({
  ...row,
  average_score:
    row.average_score === null ? null : Number(row.average_score),
  score_communication:
    row.score_communication === null ? null : Number(row.score_communication),
  score_attitude:
    row.score_attitude === null ? null : Number(row.score_attitude),
  score_skill: row.score_skill === null ? null : Number(row.score_skill),
  score_team_fit:
    row.score_team_fit === null ? null : Number(row.score_team_fit),
});

const fail = (error: { code?: string; message?: string }, action: string): never => {
  if (error.code === "42501")
    throw new RecruitmentError("Akses ditolak", 403);
  if (error.code === "23505")
    throw new RecruitmentError(
      "Jadwal ronde ini sudah tercatat. Muat ulang lalu coba lagi.",
      409,
    );
  if (error.code === "23514" || error.code === "P0001") {
    const message = error.message?.replace(/^.*?:\s*/, "") ?? "";
    throw new RecruitmentError(
      message || "Data jadwal tidak valid. Periksa kembali isian.",
      400,
    );
  }
  throw new RecruitmentError(`Gagal ${action} jadwal wawancara`, 500);
};

export async function listInterviewSchedules(): Promise<InterviewSchedule[]> {
  const { data, error } = await (await getServerSupabase())
    .from("interview_schedule_view")
    .select(VIEW_COLUMNS)
    .order("scheduled_at", { ascending: true })
    .limit(INTERVIEW_LIMIT);

  if (error) fail(error, "memuat");
  return ((data ?? []) as unknown as ViewRow[]).map(mapRow);
}

export async function listApplicationInterviews(
  applicationId: string,
): Promise<InterviewSchedule[]> {
  assertId(applicationId);
  const { data, error } = await (await getServerSupabase())
    .from("interview_schedule_view")
    .select(VIEW_COLUMNS)
    .eq("application_id", applicationId)
    .order("round_number", { ascending: true });

  if (error) fail(error, "memuat");
  return ((data ?? []) as unknown as ViewRow[]).map(mapRow);
}

export async function getUpcomingInterviews(
  limit = 5,
): Promise<InterviewSchedule[]> {
  const { data, error } = await (await getServerSupabase())
    .from("interview_schedule_view")
    .select(VIEW_COLUMNS)
    .eq("status", "Dijadwalkan")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) fail(error, "memuat");
  return ((data ?? []) as unknown as ViewRow[]).map(mapRow);
}

async function getInterviewSchedule(
  id: string,
): Promise<InterviewSchedule | null> {
  assertId(id);
  const { data, error } = await (await getServerSupabase())
    .from("interview_schedule_view")
    .select(VIEW_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) fail(error, "memuat");
  return data ? mapRow(data as unknown as ViewRow) : null;
}

async function findConflictWarning({
  applicationId,
  interviewerName,
  scheduledAt,
  durationMinutes,
  excludeId,
}: {
  applicationId: string;
  interviewerName: string;
  scheduledAt: string;
  durationMinutes: number;
  excludeId?: string;
}): Promise<string | null> {
  const start = new Date(scheduledAt).getTime();
  const end = start + durationMinutes * 60_000;
  const windowStart = new Date(start - 480 * 60_000).toISOString();

  let query = (await getServerSupabase())
    .from("interviews")
    .select("id,application_id,interviewer_name,scheduled_at,duration_minutes")
    .neq("status", "Dibatalkan")
    .gte("scheduled_at", windowStart)
    .lt("scheduled_at", new Date(end).toISOString())
    .limit(100);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) return null;

  const name = interviewerName.trim().toLowerCase();
  let sameApplicant = false;
  let sameInterviewer = false;

  for (const row of (data ?? []) as {
    application_id: string;
    interviewer_name: string;
    scheduled_at: string;
    duration_minutes: number;
  }[]) {
    const existingStart = new Date(row.scheduled_at).getTime();
    const existingEnd = existingStart + row.duration_minutes * 60_000;
    if (existingStart >= end || existingEnd <= start) continue;
    if (row.application_id === applicationId) sameApplicant = true;
    if (row.interviewer_name.trim().toLowerCase() === name)
      sameInterviewer = true;
  }

  const parts: string[] = [];
  if (sameApplicant)
    parts.push("pelamar ini sudah punya jadwal wawancara pada waktu yang sama");
  if (sameInterviewer)
    parts.push(
      `pewawancara ${interviewerName.trim()} sudah punya jadwal lain pada waktu yang sama`,
    );

  return parts.length ? `Perhatian: ${parts.join(" dan ")}.` : null;
}

export async function createInterview(
  applicationId: string,
  input: InterviewInput,
): Promise<{ interview: InterviewSchedule; warning: string | null }> {
  assertId(applicationId);
  const warning = await findConflictWarning({
    applicationId,
    interviewerName: input.interviewer_name,
    scheduledAt: input.scheduled_at,
    durationMinutes: input.duration_minutes,
  });

  const { data, error } = await (await getServerSupabase())
    .from("interviews")
    .insert({
      application_id: applicationId,
      scheduled_at: input.scheduled_at,
      duration_minutes: input.duration_minutes,
      mode: input.mode,
      location_or_link: input.location_or_link,
      interviewer_name: input.interviewer_name,
      notes: input.notes,
    })
    .select("id")
    .single();

  if (error) fail(error, "menyimpan");
  const interview = await getInterviewSchedule((data as { id: string }).id);
  if (!interview)
    throw new RecruitmentError(
      "Jadwal tersimpan tetapi gagal dibaca kembali",
      500,
    );
  return { interview, warning };
}

export async function updateInterviewSchedule(
  id: string,
  input: InterviewInput,
): Promise<{ interview: InterviewSchedule; warning: string | null }> {
  const current = await getInterviewSchedule(id);
  if (!current) throw new RecruitmentError("Jadwal tidak ditemukan", 404);
  if (current.status !== "Dijadwalkan")
    throw new RecruitmentError(
      "Jadwal yang sudah selesai atau dibatalkan tidak bisa diubah.",
      409,
    );

  const warning = await findConflictWarning({
    applicationId: current.application_id,
    interviewerName: input.interviewer_name,
    scheduledAt: input.scheduled_at,
    durationMinutes: input.duration_minutes,
    excludeId: id,
  });

  const { error } = await (await getServerSupabase())
    .from("interviews")
    .update({
      scheduled_at: input.scheduled_at,
      duration_minutes: input.duration_minutes,
      mode: input.mode,
      location_or_link: input.location_or_link,
      interviewer_name: input.interviewer_name,
      notes: input.notes,
    })
    .eq("id", id)
    .eq("status", "Dijadwalkan");

  if (error) fail(error, "memperbarui");
  const interview = await getInterviewSchedule(id);
  if (!interview)
    throw new RecruitmentError("Jadwal tidak ditemukan", 404);
  return { interview, warning };
}

export async function updateInterviewStatus(
  id: string,
  status: InterviewStatus,
): Promise<InterviewSchedule> {
  const current = await getInterviewSchedule(id);
  if (!current) throw new RecruitmentError("Jadwal tidak ditemukan", 404);
  if (current.status === status) return current;
  if (current.status !== "Dijadwalkan")
    throw new RecruitmentError(
      "Status wawancara ini sudah final dan tidak bisa diubah.",
      409,
    );

  const { error } = await (await getServerSupabase())
    .from("interviews")
    .update({ status })
    .eq("id", id)
    .eq("status", "Dijadwalkan");

  if (error) fail(error, "memperbarui");
  const interview = await getInterviewSchedule(id);
  if (!interview)
    throw new RecruitmentError("Jadwal tidak ditemukan", 404);
  return interview;
}

export async function saveInterviewEvaluation(
  interviewId: string,
  input: InterviewEvaluationInput,
): Promise<InterviewSchedule> {
  const current = await getInterviewSchedule(interviewId);
  if (!current) throw new RecruitmentError("Jadwal tidak ditemukan", 404);
  if (current.status !== "Selesai")
    throw new RecruitmentError(
      "Tandai wawancara Selesai terlebih dahulu sebelum mengisi evaluasi.",
      409,
    );

  const { error } = await (await getServerSupabase())
    .from("interview_evaluations")
    .upsert(
      { interview_id: interviewId, ...input },
      { onConflict: "interview_id" },
    )
    .select("id")
    .single();

  if (error) fail(error, "menyimpan evaluasi");
  const interview = await getInterviewSchedule(interviewId);
  if (!interview)
    throw new RecruitmentError("Jadwal tidak ditemukan", 404);
  return interview;
}
