import { notFound } from "next/navigation";
import { getPublicJob } from "@/lib/recruitment/live/public-repository";
import { ApplicationWizard } from "@/components/careers/application-wizard";
import { JobDetails } from "@/components/careers/job-details";

export const metadata = {
  title: "Form Lamaran · SAMAQU Karir",
  robots: { index: false, follow: false },
};

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getPublicJob(slug);
  if (!job) notFound();
  if (job.status !== "Aktif") return <JobDetails job={job} />;
  return <ApplicationWizard key={job.id} job={job} />;
}
