import { notFound } from "next/navigation";
import { getPublicJob } from "@/lib/recruitment/live/public-repository";
import { JobDetails } from "@/components/careers/job-details";

export default async function JobPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getPublicJob(slug);
  if (!job) notFound();
  return <JobDetails job={job} />;
}
