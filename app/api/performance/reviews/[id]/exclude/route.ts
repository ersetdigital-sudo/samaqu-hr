import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  performanceFailure,
  performanceStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/performance/http";
import {
  excludePerformanceReview,
  PerformanceDataError,
} from "@/lib/performance/repository";

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
    const body = await readJsonObject(request);
    const reason = textValue(body.reason);
    if (!reason) {
      throw new PerformanceDataError("Alasan pengecualian wajib diisi", 400);
    }
    await excludePerformanceReview(id, reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return performanceFailure(error, "gagal mengecualikan penilaian");
  }
}
