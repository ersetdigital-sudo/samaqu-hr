import { NextResponse } from "next/server";
import { performanceFailure, performanceUserGuard } from "@/lib/performance/http";
import { getMyPerformanceResults } from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await performanceUserGuard();
  if (guard.response) return guard.response;
  try {
    const results = await getMyPerformanceResults(guard.user.employeeId);
    return NextResponse.json(
      { results, linked: Boolean(guard.user.employeeId) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return performanceFailure(error, "gagal memuat penilaian saya");
  }
}
