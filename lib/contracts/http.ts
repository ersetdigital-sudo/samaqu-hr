/** Helper bersama route API kontrak: cek sesi/permission + pemetaan error. */

import { NextResponse } from "next/server";
import { ContractDataError } from "@/lib/contracts/repository";
import { requireApiModule } from "@/lib/auth/guard";

/** Kontrak berada di modul Employee Management (hr_manager). */
export const contractsGuard = () => requireApiModule("employees");

export function contractErrorResponse(error: unknown, context: string) {
  if (error instanceof ContractDataError) {
    return NextResponse.json(
      { error: error.message, ...(error.errors ? { errors: error.errors } : {}) },
      { status: error.status }
    );
  }

  console.error(`[contracts] ${context}`, error);
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data kontrak" },
    { status: 500 }
  );
}
