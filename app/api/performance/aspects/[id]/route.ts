import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  numberValue,
  performanceFailure,
  performanceStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/performance/http";
import {
  listPerformanceAspects,
  PerformanceDataError,
  savePerformanceAspect,
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
    const name = textValue(body.name);
    const description = textValue(body.description);
    const sortOrder = numberValue(body.sortOrder);
    if (typeof body.isActive !== "boolean") {
      throw new PerformanceDataError("Status aktif aspek tidak valid", 400);
    }
    const isActive = body.isActive;
    if (!name) throw new PerformanceDataError("Nama aspek wajib diisi", 400);
    if (!Number.isFinite(sortOrder)) {
      throw new PerformanceDataError("Urutan aspek tidak valid", 400);
    }
    await savePerformanceAspect(id, { name, description, sortOrder, isActive });
    const aspects = await listPerformanceAspects();
    return NextResponse.json({ ok: true, aspects });
  } catch (error) {
    return performanceFailure(error, "gagal mengubah aspek");
  }
}
