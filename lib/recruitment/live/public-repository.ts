import "server-only";
import { randomUUID } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { ApplicationInput, PublicJob } from "@/lib/recruitment/live/types";
import {
  effectiveStatus,
  jakartaDate,
  normalizeWhatsapp,
} from "@/lib/recruitment/live/validation";
import { dbFailure, RecruitmentError } from "@/lib/recruitment/live/http";

const PUBLIC_COLUMNS =
  "id,slug,title,department,location,employment_type,headcount,summary,duties,qualifications,closes_at,status,published_at,closed_at,created_at,updated_at";
export async function getPublicJobs(): Promise<PublicJob[]> {
  const db = getServiceSupabase();
  const jobs: PublicJob[] = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await db
      .from("job_postings")
      .select(PUBLIC_COLUMNS)
      .eq("status", "Aktif")
      .or(`closes_at.is.null,closes_at.gte.${jakartaDate()}`)
      .order("published_at", { ascending: false })
      .order("id")
      .range(from, from + 199);
    if (error) dbFailure(error);
    jobs.push(...(data as PublicJob[]));
    if (data.length < 200) break;
  }
  return jobs;
}
export async function getPublicJob(slug: string): Promise<PublicJob | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120)
    return null;
  const { data, error } = await getServiceSupabase()
    .from("job_postings")
    .select(PUBLIC_COLUMNS)
    .eq("slug", slug)
    .neq("status", "Draf")
    .maybeSingle();
  if (error) dbFailure(error);
  if (!data) return null;
  const job = data as PublicJob;
  return { ...job, status: effectiveStatus(job.status, job.closes_at) };
}
export async function submitApplication(
  jobId: string,
  input: ApplicationInput,
  file: File,
): Promise<string> {
  const db = getServiceSupabase();
  const { data: job, error: jobError } = await db
    .from("job_postings")
    .select("status,closes_at")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) dbFailure(jobError);
  if (!job || effectiveStatus(job.status, job.closes_at) !== "Aktif")
    throw new RecruitmentError(
      "Lowongan ini sudah ditutup atau tidak tersedia",
      409,
    );
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  const duplicate = await db
    .from("job_applications")
    .select("id", { head: true, count: "exact" })
    .eq("job_id", jobId)
    .eq("whatsapp", whatsapp)
    .gte("created_at", new Date(Date.now() - 86400000).toISOString());
  if (duplicate.error) dbFailure(duplicate.error);
  if (duplicate.count)
    throw new RecruitmentError(
      "Nomor WhatsApp ini sudah melamar lowongan yang sama dalam 24 jam terakhir",
      409,
    );
  const stale = await db.rpc("unreferenced_recruitment_cvs");
  if (!stale.error && stale.data?.length) {
    const cleanup = await db.storage
      .from("cvs")
      .remove(stale.data.map((row: { path: string }) => row.path));
    if (cleanup.error)
      console.error(
        "[recruitment] Deferred CV cleanup will retry on next submission",
      );
  }
  const path = `${jobId}/${randomUUID()}.pdf`;
  const upload = await db.storage
    .from("cvs")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (upload.error)
    throw new RecruitmentError(
      "CV belum berhasil diupload. Silakan coba lagi.",
      500,
    );
  const data: ApplicationInput = {
    full_name: input.full_name.trim(),
    whatsapp,
    email: input.email.trim().toLowerCase(),
    birth_date: input.birth_date,
    city: input.city.trim(),
    education: input.education,
    has_admin_experience: input.has_admin_experience,
    last_position: input.has_admin_experience ? input.last_position.trim() : "",
    last_company: input.has_admin_experience ? input.last_company.trim() : "",
    experience_length: input.has_admin_experience
      ? input.experience_length
      : "",
    skills: input.skills,
    expected_salary: input.expected_salary,
    start_availability: input.start_availability,
    source: input.source,
    portfolio_url: input.portfolio_url?.trim() || "",
    motivation: input.motivation?.trim() || "",
    consent: true,
  };
  const result = await db.rpc("submit_job_application", {
    p_job_id: jobId,
    p_data: data,
    p_cv_path: path,
  });
  if (result.error) {
    // A lost RPC response does not prove its transaction rolled back.
    const committed = await db
      .from("job_applications")
      .select("application_number")
      .eq("cv_path", path)
      .maybeSingle();
    if (committed.data) return committed.data.application_number;
    if (
      !committed.error &&
      result.error.code &&
      !result.error.code.startsWith("PGRST")
    ) {
      const cleanup = await db.storage.from("cvs").remove([path]);
      if (cleanup.error)
        console.error(
          "[recruitment] Deferred CV cleanup will retry on next submission",
        );
    }
    if (result.error.code === "23505")
      throw new RecruitmentError(
        "Nomor WhatsApp ini sudah melamar lowongan yang sama dalam 24 jam terakhir",
        409,
      );
    if (result.error.code === "P0001")
      throw new RecruitmentError(
        "Lowongan ini sudah ditutup atau tidak tersedia",
        409,
      );
    dbFailure(result.error);
  }
  return result.data as string;
}
