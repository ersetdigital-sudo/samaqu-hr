/**
 * Menukar tautan email Supabase (undangan / reset password) menjadi session.
 *
 * Mendukung `token_hash` + `type` (email OTP) maupun `code` (PKCE).
 * Setelah session terbentuk, pengguna diarahkan ke halaman tujuan internal.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

const SAFE_NEXT = ["/reset-password", "/settings/users", "/"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const requested = searchParams.get("next") ?? "/reset-password";
  const next = SAFE_NEXT.includes(requested) ? requested : "/reset-password";

  const supabase = await getServerSupabase();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}
