import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { careersUrl, isCareersHost, normalizeHost } from "@/lib/careers/urls";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const host = normalizeHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  );

  if (!isCareersHost(host))
    return { rules: [{ userAgent: "*", disallow: "/" }] };

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: careersUrl("/sitemap.xml"),
    host: careersUrl("/"),
  };
}
