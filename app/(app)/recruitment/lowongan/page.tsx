import { JobsList } from "@/components/recruitment-live/jobs-list";
import { requireRole } from "@/lib/auth/session";
import { listJobs } from "@/lib/recruitment/live/repository";

export default async function RecruitmentLowonganPage() {
  await requireRole(["hr_manager", "recruiter"]);
  try {
    const jobs = await listJobs();
    return <JobsList jobs={jobs} />;
  } catch {
    return (
      <JobsList
        jobs={[]}
        error="Daftar lowongan belum dapat dimuat. Silakan coba lagi."
      />
    );
  }
}
