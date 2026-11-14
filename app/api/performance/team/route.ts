import { NextResponse } from "next/server";
import { performanceFailure, performanceUserGuard } from "@/lib/performance/http";
import { getPerformanceTeamRows } from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await performanceUserGuard();
  if (guard.response) return guard.response;
  try {
    const rows = await getPerformanceTeamRows(guard.user.employeeId);
    return NextResponse.json(
      { rows, reviewerEmployeeId: guard.user.employeeId },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return performanceFailure(error, "gagal memuat penilaian tim");
  }
}
