import { NextResponse } from "next/server";
import {
  assertUuid,
  performanceFailure,
  performanceUserGuard,
} from "@/lib/performance/http";
import {
  getPerformanceReviewDetail,
  PerformanceDataError,
} from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await performanceUserGuard();
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    assertUuid(id);
    const detail = await getPerformanceReviewDetail(id);
    if (!detail) {
      throw new PerformanceDataError("Lembar penilaian tidak ditemukan", 404);
    }
    return NextResponse.json(detail, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return performanceFailure(error, "gagal memuat lembar penilaian");
  }
}
