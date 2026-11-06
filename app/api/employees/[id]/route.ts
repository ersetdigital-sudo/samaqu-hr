/**
 * Detail & perubahan satu karyawan.
 *
 * NIK KTP hanya dikembalikan di endpoint ini (bukan di daftar/pencarian),
 * dan hanya untuk role yang berhak membuka modul Employee Management.
 */

import { NextResponse } from "next/server";
import {
  EmployeeDataError,
  getEmployeeDetail,
  updateEmployee,
  updateEmployeeStatus,
} from "@/lib/employees/repository";
import {
  EMPLOYEE_STATUSES,
  type EmployeeInput,
  type EmployeeStatus,
} from "@/lib/employees/types";
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiModule("employees");
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const employee = await getEmployeeDetail(id);

    if (!employee) {
      return NextResponse.json(
        { error: "Karyawan tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { employee },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return fail(error, "gagal memuat detail karyawan");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiModule("employees");
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const body = (await request.json()) as
      | Partial<EmployeeInput>
      | { status?: EmployeeStatus };

    // Perubahan status saja (aksi cepat dari detail karyawan).
    if ("status" in body && Object.keys(body).length === 1) {
      const status = body.status;
      if (!status || !EMPLOYEE_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: "Status karyawan tidak valid" },
          { status: 400 }
        );
      }
      const employee = await updateEmployeeStatus(id, status);
      if (!employee) {
        return NextResponse.json(
          { error: "Karyawan tidak ditemukan" },
          { status: 404 }
        );
      }
      return NextResponse.json({ employee });
    }

    const input = body as EmployeeInput;
    const errors = validateEmployee(input);

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const employee = await updateEmployee(id, input);

    if (!employee) {
      return NextResponse.json(
        { error: "Karyawan tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ employee });
  } catch (error) {
    return fail(error, "gagal memperbarui karyawan");
  }
}
