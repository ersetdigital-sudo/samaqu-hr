import { NextResponse } from "next/server";
import { overtimeFailure, overtimeSelfGuard } from "@/lib/overtime/http";
import { getMyOvertimeData } from "@/lib/overtime/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await overtimeSelfGuard();
  if (guard.response) return guard.response;

  try {
    const data = await getMyOvertimeData();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return overtimeFailure(error, "gagal memuat lembur karyawan");
  }
}
