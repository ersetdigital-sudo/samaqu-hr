/**
 * Aksi Reaktivasi karyawan (Nonaktif → Aktif).
 *
 * Otorisasi diperiksa di server: hanya `hr_manager`. Alasan wajib, dan audit
 * dicatat database dalam transaksi yang sama (employee_status_history).
 * Reaktivasi tidak membuat kontrak otomatis dan tidak mengubah data lain.
 */

import { NextResponse } from "next/server";
import {
  EmployeeDataError,
  reactivateEmployee,
} from "@/lib/employees/repository";
import { requireApiRole } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const fail = (error: unknown, context: string) => {
  if (error instanceof EmployeeDataError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`[employees] ${context}`, error);
  return NextResponse.json(
    { error: "Terjadi kesalahan saat mereaktivasi karyawan" },
    { status: 500 }
  );
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiRole(["hr_manager"]);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      reason?: unknown;
    };
    const reason = typeof body.reason === "string" ? body.reason : "";

    if (!reason.trim()) {
      return NextResponse.json(
        { error: "Alasan reaktivasi wajib diisi" },
        { status: 400 }
      );
    }

    const employee = await reactivateEmployee(id, reason);

    if (!employee) {
      return NextResponse.json(
        { error: "Karyawan tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ employee });
  } catch (error) {
    return fail(error, "gagal mereaktivasi karyawan");
  }
}
