/**
 * Proxy (pengganti middleware pada Next 16).
 *
 * Tugas: me-refresh cookie session Supabase dan menolak akses halaman internal
 * tanpa session. Otorisasi role tetap diperiksa di server (layout/API), proxy
 * bukan satu-satunya perlindungan.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_HOST,
  careersBaseUrl,
  isAdminHost,
  isCareersHost,
  normalizeHost,
  resolveCareersRoute,
} from "@/lib/careers/urls";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/akun-tidak-aktif",
  "/unauthorized",
  "/auth/confirm",
  "/karir",
  "/knowledge-hub",
  "/knowledge",
  "/learning",
  "/api/karir/lamaran",
  "/api/cron/cv-retention",
];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some(
    (path) =>
      pathname === path ||
      (!path.startsWith("/api/") && pathname.startsWith(`${path}/`)),
  );

const CONFIG_ERROR_MESSAGE =
  "Konfigurasi Supabase belum lengkap. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di environment server.";

const CONFIG_ERROR_PAGE = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Konfigurasi belum lengkap · SAMAQU HRIS</title>
<style>
  body { font-family: system-ui, sans-serif; background: #FAF8F6; color: #1F1A1C; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 24px; }
  main { width: 100%; max-width: 560px; background: #fff; border: 1px solid #ECE7E4; border-radius: 14px; padding: 32px; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  p { font-size: 14px; line-height: 1.6; color: #6F6669; margin: 0; }
  code { background: #F2F0EF; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #1F1A1C; }
</style>
</head>
<body>
<main>
<h1>Konfigurasi server belum lengkap</h1>
<p>${CONFIG_ERROR_MESSAGE}</p>
<p style="margin-top: 12px"><code>NEXT_PUBLIC_SUPABASE_URL</code> · <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></p>
</main>
</body>
</html>`;

/** Gagal aman: konfigurasi kosong tidak boleh membuka akses tanpa sesi. */
function configErrorResponse(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: CONFIG_ERROR_MESSAGE },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return new NextResponse(CONFIG_ERROR_PAGE, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const host = normalizeHost(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  );

  const withAdminRobots = (response: NextResponse) => {
    if (isAdminHost(host))
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  };

  if (!url || !anonKey) {
    console.warn("[proxy] Supabase env belum lengkap; akses ditolak.");
    return withAdminRobots(configErrorResponse(request));
  }

  // Domain karir hanya melayani lowongan publik dan endpoint form lamaran.
  if (isCareersHost(host)) {
    const route = resolveCareersRoute(request.nextUrl.pathname);

    switch (route.type) {
      case "allow":
        return NextResponse.next({ request });
      case "rewrite": {
        const target = request.nextUrl.clone();
        target.pathname = route.pathname;
        return NextResponse.rewrite(target);
      }
      case "redirect": {
        const target = request.nextUrl.clone();
        target.pathname = route.location;
        return NextResponse.redirect(target, 301);
      }
      case "block":
        return NextResponse.json(
          { error: "Tidak ditemukan." },
          { status: 404, headers: { "Cache-Control": "no-store" } },
        );
      case "to-admin": {
        const target = new URL(`https://${ADMIN_HOST}`);
        target.pathname = request.nextUrl.pathname;
        target.search = request.nextUrl.search;
        return NextResponse.redirect(target, 308);
      }
    }
  }

  const { pathname, search } = request.nextUrl;

  // Link lama di domain admin dipindah permanen ke domain karir.
  if (
    isAdminHost(host) &&
    (pathname === "/karir" || pathname.startsWith("/karir/"))
  ) {
    const target = pathname.slice("/karir".length) || "/";
    return NextResponse.redirect(
      new URL(`${careersBaseUrl()}${target}${search}`),
      301,
    );
  }

  let response = NextResponse.next({ request });

  // Public pages and the application endpoint do not need a session lookup.
  // Keep /login dynamic so an already signed-in user is still redirected home.
  if (isPublic(pathname) && pathname !== "/login") {
    return withAdminRobots(response);
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return withAdminRobots(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|eot|css|js|map|txt|xml|webmanifest)$).*)",
  ],
};
