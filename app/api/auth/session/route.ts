/**
 * Verifikasi sesi setelah login.
 *
 * Menolak akun yang profilnya tidak ada / tidak Aktif / tanpa role (403),
 * lalu mencatat `last_sign_in_at`. Identitas selalu dari Supabase Auth.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { getServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak ada sesi aktif" }, { status: 401 });
  }
  return NextResponse.json({ user });
}

export async function POST() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json(
      { error: "Akun ini belum memiliki akses aktif" },
      { status: 403 }
    );
  }

  const { error } = await getServiceSupabase()
    .from("user_profiles")
    .update({ last_sign_in_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("[auth] gagal mencatat waktu login", error);
  }

  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role },
  });
}
