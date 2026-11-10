/**
 * Sesi autentikasi server-side.
 *
 * Identitas diambil dari Supabase Auth (`auth.getUser()` — diverifikasi ke
 * server auth, bukan sekadar cookie), lalu role diambil dari database
 * (`user_profiles` + `user_roles`). Role tidak pernah berasal dari input klien.
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { initialsOf, type SessionUser } from "@/lib/session";
import { isSuperuser, type Role } from "@/lib/navigation";

/** Urutan prioritas bila pengguna punya lebih dari satu role. */
const ROLE_PRIORITY: Role[] = ["admin", "hr_manager", "recruiter", "employee"];

const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLE_PRIORITY as string[]).includes(value);

type ProfileRow = {
  full_name: string;
  email: string;
  account_status: string;
  employee_id: string | null;
};

/** User Supabase Auth mentah; dipakai untuk membedakan "tanpa sesi" dan "sesi tanpa akses". */
const getSupabaseAuthUser = cache(async () => {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Pengguna terautentikasi dengan akun Aktif dan role valid, atau `null`.
 * Akun Nonaktif / Diundang / tanpa role dianggap tidak punya akses.
 *
 * Akun Diundang yang sudah punya sesi (berhasil login pertama kali)
 * diaktifkan lewat RPC server-side, hanya untuk baris miliknya sendiri.
 */
export const getAuthUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await getServerSupabase();
  const user = await getSupabaseAuthUser();

  if (!user) return null;

  // Profil dan role hanya bergantung pada user.id: ambil paralel, lalu
  // memo-kan hasilnya per request agar layout, page, dan guard tidak
  // mengulang auth/profile/role.
  const [profileResult, roleResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("full_name, email, account_status, employee_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("roles(name)").eq("user_id", user.id),
  ]);

  let profile = profileResult.data as ProfileRow | null;

  if (profile?.account_status === "Diundang") {
    const { data: activated, error: activationError } = await supabase.rpc(
      "activate_invited_user",
    );
    if (!activationError && activated === true) {
      profile = { ...profile, account_status: "Aktif" };
    } else if (!activationError) {
      // Bisa terjadi bila request paralel lebih dulu mengaktifkan akun ini.
      const { data: refreshed } = await supabase
        .from("user_profiles")
        .select("full_name, email, account_status, employee_id")
        .eq("id", user.id)
        .maybeSingle();
      if (refreshed) profile = refreshed as ProfileRow;
    }
  }

  if (!profile || profile.account_status !== "Aktif") return null;

  // PostgREST mengembalikan relasi sebagai objek (many-to-one) atau array
  // tergantung cache skema; tangani keduanya tanpa melemahkan tipe.
  const roleNames = ((roleResult.data ?? []) as unknown as {
    roles: { name: string } | { name: string }[] | null;
  }[])
    .flatMap((row) => {
      if (!row.roles) return [];
      return Array.isArray(row.roles)
        ? row.roles.map((item) => item.name)
        : [row.roles.name];
    })
    .filter(isRole);

  const role = ROLE_PRIORITY.find((candidate) => roleNames.includes(candidate));
  if (!role) return null;

  return {
    id: user.id,
    name: profile.full_name,
    email: profile.email,
    role,
    initials: initialsOf(profile.full_name),
    employeeId: profile.employee_id,
  };
});

/** Wajib login; redirect ke /login dengan tujuan semula. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getAuthUser();
  if (!user) {
    // Sesi ada tetapi akun tidak berhak masuk: tampilkan halaman penjelasan,
    // bukan /login (proxy akan memantulkan pengguna ber-sesi kembali ke "/").
    if (await getSupabaseAuthUser()) redirect("/akun-tidak-aktif");
    redirect(
      nextPath
        ? `/login?next=${encodeURIComponent(nextPath)}`
        : "/login"
    );
  }
  return user;
}

/** Wajib login dan salah satu role yang diizinkan. */
export async function requireRole(
  roles: Role[],
  nextPath?: string
): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!isSuperuser(user.role) && !roles.includes(user.role)) {
    redirect("/unauthorized");
  }
  return user;
}
