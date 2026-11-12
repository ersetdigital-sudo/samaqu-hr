/** Helper route API Struktur Organisasi. */

import "server-only";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { OrganizationDataError } from "@/lib/organization/repository";

/** HR Manager, Admin (superuser), dan Karyawan. Recruiter ditolak. */
export const organizationGuard = () =>
  requireApiRole(["hr_manager", "employee"]);

export function organizationFailure(error: unknown) {
  if (error instanceof OrganizationDataError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  console.error("[organization] gagal memuat bagan", error);
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data struktur organisasi" },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}
