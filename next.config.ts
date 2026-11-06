import type { NextConfig } from "next";
import { ACADEMY_URL } from "./lib/external-links";

const legacyAcademyRedirects = [
  "/knowledge-hub",
  "/knowledge",
  "/learning",
].flatMap((source) => [
  { source, destination: ACADEMY_URL, permanent: true },
  { source: `${source}/:path*`, destination: ACADEMY_URL, permanent: true },
]);

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return legacyAcademyRedirects;
  },
};

export default nextConfig;
