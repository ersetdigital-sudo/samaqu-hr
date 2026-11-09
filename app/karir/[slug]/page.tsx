import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { careersUrl } from "@/lib/careers/urls";
import { getPublicJob } from "@/lib/recruitment/live/public-repository";
import { JobDetails } from "@/components/careers/job-details";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    alternates: { canonical: careersUrl(`/${encodeURIComponent(slug)}`) },
  };
}

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
