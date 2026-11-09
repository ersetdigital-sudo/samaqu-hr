/** Satu sumber untuk domain karir/admin, URL publik, dan aturan route karir. */

export const CAREERS_HOST = "karir.samaqu.id";
export const ADMIN_HOST = "hr.samaqu.id";

const DEFAULT_CAREERS_BASE_URL = `https://${CAREERS_HOST}`;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 120;

/** Route aplikasi ini tidak boleh tampil sebagai slug lowongan di domain karir. */
const RESERVED_PATHS = new Set([
  "api",
  "auth",
  "login",
  "forgot-password",
  "reset-password",
  "unauthorized",
  "settings",
  "employees",
  "recruitment",
  "reports",
  "payroll",
  "performance",
  "attendance",
  "onboarding",
  "pipeline",
  "kandidat",
  "jadwal",
  "laporan",
  "lowongan",
]);

export function normalizeHost(value: string | null | undefined): string {
  return (value ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

export function isCareersHost(host: string | null | undefined): boolean {
  return normalizeHost(host) === CAREERS_HOST;
}

export function isAdminHost(host: string | null | undefined): boolean {
  return normalizeHost(host) === ADMIN_HOST;
}

/** Null sampai NEXT_PUBLIC_CAREERS_URL diisi; fallback relatif untuk localhost. */
export function configuredCareersBaseUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_CAREERS_URL?.trim();
  return value ? value.replace(/\/+$/, "") : null;
}

/** URL absolut untuk metadata/sitemap, dengan default domain produksi. */
export function careersBaseUrl(): string {
  return configuredCareersBaseUrl() ?? DEFAULT_CAREERS_BASE_URL;
}

export function careersUrl(pathname = "/"): string {
  return `${careersBaseUrl()}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

/** Link lowongan: absolut saat env terisi, relatif agar localhost tetap jalan. */
export function careersJobHref(slug: string): string {
  const base = configuredCareersBaseUrl() ?? "/karir";
  return `${base}/${encodeURIComponent(slug)}`;
}

export function careersJobsHref(): string {
  return configuredCareersBaseUrl() ?? "/karir";
}

export type CareersRoute =
  | { type: "allow" }
  | { type: "rewrite"; pathname: string }
  | { type: "redirect"; location: string }
  | { type: "block" }
  | { type: "to-admin" };

/**
 * Route yang dilayani di karir.samaqu.id.
 *
 * - `/` → daftar lowongan (rewrite ke /karir)
 * - `/[slug]` dan `/[slug]/lamar` → halaman lowongan yang sudah ada
 * - `/api/karir/lamaran` → submit lamaran + upload CV
 * - Sisanya ditolak; path halaman diarahkan ke domain admin.
 */
export function resolveCareersRoute(pathname: string): CareersRoute {
  if (pathname === "/") return { type: "rewrite", pathname: "/karir" };

  if (pathname === "/karir" || pathname.startsWith("/karir/"))
    return { type: "redirect", location: pathname.slice("/karir".length) || "/" };

  if (pathname === "/api/karir/lamaran") return { type: "allow" };
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml")
    return { type: "allow" };

  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/"))
    return { type: "block" };

  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 1) {
    const slug = safeDecode(segments[0]);
    if (RESERVED_PATHS.has(slug)) return { type: "to-admin" };
    if (isSlug(slug)) return { type: "rewrite", pathname: `/karir/${slug}` };
  }

  if (segments.length === 2 && segments[1] === "lamar") {
    const slug = safeDecode(segments[0]);
    if (isSlug(slug)) return { type: "rewrite", pathname: `/karir/${slug}/lamar` };
  }

  return { type: "to-admin" };
}

function isSlug(value: string): boolean {
  return value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
