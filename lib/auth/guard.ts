/**
 * Penjaga route API: verifikasi session + permission (bukan hanya UI).
 *
 * 401 = belum login / session tidak valid.
 * 403 = login valid tetapi role tidak berhak.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import {
  canAccess,
  findModule,
  isSuperuser,
  subItemAllowed,
  type Role,
} from "@/lib/navigation";
import type { SessionUser } from "@/lib/session";

export type GuardResult =
  | { user: SessionUser; response?: never }
  | { user?: never; response: NextResponse };

export async function requireApiUser(): Promise<GuardResult> {
  const user = await getAuthUser();

  if (!user) {
    return {
      response: NextResponse.json(
        { error: "Silakan masuk terlebih dahulu" },
        { status: 401 }
      ),
    };
  }

  return { user };
}

/** Butuh role tertentu (mis. admin untuk manajemen akun). */
export async function requireApiRole(roles: Role[]): Promise<GuardResult> {
  const result = await requireApiUser();
  if (result.response) return result;

  if (!isSuperuser(result.user.role) && !roles.includes(result.user.role)) {
    return {
      response: NextResponse.json({ error: "Akses ditolak" }, { status: 403 }),
    };
  }

  return result;
}

/** Butuh akses modul (dan submenu bila path diberikan). */
export async function requireApiModule(
  moduleId: string,
  pathname?: string
): Promise<GuardResult> {
  const result = await requireApiUser();
  if (result.response) return result;

  const module = findModule(moduleId);
  const allowed =
    module !== undefined &&
    canAccess(result.user.role, module) &&
    (pathname === undefined || subItemAllowed(result.user.role, module, pathname));

  if (!allowed) {
    return {
      response: NextResponse.json({ error: "Akses ditolak" }, { status: 403 }),
    };
  }

  return result;
}
