import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  performanceFailure,
  performanceStaffGuard,
} from "@/lib/performance/http";
import { approvePerformanceReview } from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await performanceStaffGuard();
  if (guard.response) return guard.response;
  try {
    assertSameOrigin(request);
    const { id } = await params;
    assertUuid(id);
    await approvePerformanceReview(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return performanceFailure(error, "gagal menyetujui penilaian");
  }
}
