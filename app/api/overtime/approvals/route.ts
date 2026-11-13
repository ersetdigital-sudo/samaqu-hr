import { NextResponse } from "next/server";
import { overtimeFailure, overtimeStaffGuard } from "@/lib/overtime/http";
import { getOvertimeApprovalData } from "@/lib/overtime/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await overtimeStaffGuard();
  if (guard.response) return guard.response;

  try {
    const data = await getOvertimeApprovalData();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return overtimeFailure(error, "gagal memuat persetujuan lembur");
  }
}
