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
  PerformanceDataError,
  returnPerformanceReview,
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
      throw new PerformanceDataError("Alasan pengembalian wajib diisi", 400);
    }
    await returnPerformanceReview(id, reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return performanceFailure(error, "gagal mengembalikan penilaian");
  }
}
