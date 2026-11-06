import { notFound } from "next/navigation";
import { Applicants } from "@/components/recruitment-live/applicants";
import { requireRole } from "@/lib/auth/session";
import { getJob, listApplications } from "@/lib/recruitment/live/repository";

export default async function JobApplicantsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["hr_manager", "recruiter"]);
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  try {
    const initial = await listApplications(id);
    return <Applicants key={id} job={job} initial={initial} />;
  } catch {
    return <Applicants key={id} job={job} initial={{ applications: [], total: 0, unreviewed: 0, stage_counts: {}, page: 1, page_size: 10 }} initialError="Daftar pelamar belum dapat dimuat. Silakan coba lagi." />;
  }
}
