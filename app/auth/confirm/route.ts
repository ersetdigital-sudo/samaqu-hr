/**
 * Menukar tautan email Supabase (undangan / reset password) menjadi session.
 *
 * Mendukung `token_hash` + `type` (email OTP) dan `code` (PKCE). Undangan dan
 * reset selalu diarahkan ke halaman atur kata sandi, tanpa pemeriksaan status
 * akun — status ditegakkan setelah kata sandi disimpan.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

const SAFE_NEXT = ["/reset-password", "/settings/users", "/"];

/** Undangan & reset password wajib mendarat di halaman atur kata sandi. */
const PASSWORD_TYPES = new Set<string>(["invite", "recovery"]);

type PendingCookie = { name: string; value: string; options?: CookieOptions };

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const requested = searchParams.get("next") ?? "/reset-password";
  const next =
    code || (type && PASSWORD_TYPES.has(type))
      ? "/reset-password"
      : SAFE_NEXT.includes(requested)
        ? requested
        : "/reset-password";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey)
    return NextResponse.redirect(new URL("/login?error=link", origin));

  // Kumpulkan cookie sesi dari Supabase, lalu tempel eksplisit ke response
  // redirect agar tidak bergantung pada propagasi cookie global.
  const pending: PendingCookie[] = [];
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          pending.push({ name, value, options }),
        );
      },
    },
  });

  let verified = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    verified = !error;
  }

  if (!verified && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  }

  if (!verified)
    return NextResponse.redirect(new URL("/login?error=link", origin));

  const redirect = NextResponse.redirect(new URL(next, origin));
  pending.forEach(({ name, value, options }) =>
    redirect.cookies.set(name, value, options),
  );
  return redirect;
}
