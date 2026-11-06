/**
 * Tipe sesi pengguna dan label role.
 *
 * Sumber identitas sebenarnya ada di Supabase Auth + tabel `user_profiles` /
 * `user_roles` (lihat `lib/auth/session.ts`). Tidak ada lagi pengguna statis.
 */

import type { Role } from "@/lib/navigation";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  employeeId: string | null;
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  hr_manager: "HR Manager",
  recruiter: "Recruiter",
  employee: "Karyawan",
};

export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
