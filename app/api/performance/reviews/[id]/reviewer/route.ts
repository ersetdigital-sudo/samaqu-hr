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
  setPerformanceReviewer,
} from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export async function PATCH(
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
    const reviewerEmployeeId = textValue(body.reviewerEmployeeId);
    const reason = textValue(body.reason);
    if (!reviewerEmployeeId) {
      throw new PerformanceDataError("Penilai wajib dipilih", 400);
    }
    if (!reason) {
      throw new PerformanceDataError("Alasan penggantian penilai wajib diisi", 400);
    }
    await setPerformanceReviewer(id, reviewerEmployeeId, reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return performanceFailure(error, "gagal mengganti penilai");
  }
}
