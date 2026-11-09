import { notFound } from "next/navigation";
import { Applicants } from "@/components/recruitment-live/applicants";
import { requireRole } from "@/lib/auth/session";
import { canManageEmployees } from "@/lib/navigation";
import { getJob, listApplications } from "@/lib/recruitment/live/repository";

export default async function JobApplicantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["hr_manager", "recruiter"]);
  const canConvert = canManageEmployees(user.role);
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  try {
    const initial = await listApplications(id);
    return (
      <Applicants
        key={id}
        job={job}
        initial={initial}
        canConvert={canConvert}
      />
    );
  } catch {
    return (
      <Applicants
        key={id}
        job={job}
        initial={{
          applications: [],
          total: 0,
          unreviewed: 0,
          stage_counts: {},
          page: 1,
          page_size: 10,
        }}
        initialError="Daftar pelamar belum dapat dimuat. Silakan coba lagi."
        canConvert={canConvert}
      />
    );
  }
}
