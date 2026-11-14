import { NextResponse } from "next/server";
import {
  assertUuid,
  performanceFailure,
  performanceStaffGuard,
} from "@/lib/performance/http";
import {
  getPerformancePeriodDetail,
  PerformanceDataError,
} from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await performanceStaffGuard();
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    assertUuid(id);
    const detail = await getPerformancePeriodDetail(id);
    if (!detail) throw new PerformanceDataError("Periode tidak ditemukan", 404);
    return NextResponse.json(detail, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return performanceFailure(error, "gagal memuat detail periode");
  }
}
