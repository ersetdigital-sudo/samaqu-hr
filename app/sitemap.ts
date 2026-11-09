import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { careersUrl, isCareersHost, normalizeHost } from "@/lib/careers/urls";
import { getPublicJobs } from "@/lib/recruitment/live/public-repository";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const host = normalizeHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );
  if (!isCareersHost(host)) return [];

  const jobs = await getPublicJobs();
  return [
    {
      url: careersUrl("/"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...jobs.map((job) => ({
      url: careersUrl(`/${job.slug}`),
      lastModified: new Date(job.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
