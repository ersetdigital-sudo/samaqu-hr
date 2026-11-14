import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  performanceFailure,
  performanceUserGuard,
} from "@/lib/performance/http";
import { submitPerformanceReview } from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await performanceUserGuard();
  if (guard.response) return guard.response;
  try {
    assertSameOrigin(request);
    const { id } = await params;
    assertUuid(id);
    await submitPerformanceReview(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return performanceFailure(error, "gagal mengirim penilaian");
  }
}
