import { notFound } from "next/navigation";
import { JobForm } from "@/components/recruitment-live/job-form";
import { requireRole } from "@/lib/auth/session";
import { getDepartments, getJob } from "@/lib/recruitment/live/repository";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["hr_manager", "recruiter"]);
  const { id } = await params;
  const [job, departments] = await Promise.all([getJob(id), getDepartments()]);
  if (!job) notFound();
  return <JobForm key={job.id} initial={job} departments={departments} />;
}
