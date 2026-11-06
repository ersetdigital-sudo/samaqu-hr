/**
 * Endpoint direktori karyawan.
 *
 * GET hanya mengembalikan ringkasan (tanpa NIK, tanpa kontak pribadi).
 * NIK keluar hanya lewat `/api/employees/[id]` untuk role yang berhak.
 */

import { NextResponse } from "next/server";
import {
  EmployeeDataError,
  createEmployee,
  getNextEmployeeId,
  listEmployeeSummaries,
} from "@/lib/employees/repository";
import type { EmployeeInput } from "@/lib/employees/types";
import { validateEmployee } from "@/lib/employees/validation";
import { requireApiModule } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const fail = (error: unknown, context: string) => {
  if (error instanceof EmployeeDataError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }
  console.error(`[employees] ${context}`, error);
  return NextResponse.json(
    { error: "Terjadi kesalahan pada data karyawan" },
    { status: 500 }
  );
};

export async function GET() {
  const guard = await requireApiModule("employees");
  if (guard.response) return guard.response;

  try {
    const [employees, nextId] = await Promise.all([
      listEmployeeSummaries(),
      getNextEmployeeId(),
    ]);

    return NextResponse.json(
      { employees, nextId },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return fail(error, "gagal memuat direktori");
  }
}

export async function POST(request: Request) {
  const guard = await requireApiModule("employees");
  if (guard.response) return guard.response;

  try {
    const body = (await request.json()) as EmployeeInput;
    const errors = validateEmployee(body);

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const employee = await createEmployee(body);
    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    return fail(error, "gagal menambah karyawan");
  }
}
