import { NextResponse } from "next/server";
import {
  assertSameOrigin,
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

function aspectInput(body: Record<string, unknown>) {
  const name = textValue(body.name);
  const description = textValue(body.description);
  const sortOrder = numberValue(body.sortOrder);
  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
  if (!name) throw new PerformanceDataError("Nama aspek wajib diisi", 400);
  if (!Number.isFinite(sortOrder)) {
    throw new PerformanceDataError("Urutan aspek tidak valid", 400);
  }
  return { name, description, sortOrder, isActive };
}

export async function GET() {
  const guard = await performanceStaffGuard();
  if (guard.response) return guard.response;
  try {
    const aspects = await listPerformanceAspects();
    return NextResponse.json(
      { aspects },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return performanceFailure(error, "gagal memuat aspek");
  }
}

export async function POST(request: Request) {
  const guard = await performanceStaffGuard();
  if (guard.response) return guard.response;
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    await savePerformanceAspect(null, aspectInput(body));
    const aspects = await listPerformanceAspects();
    return NextResponse.json({ ok: true, aspects }, { status: 201 });
  } catch (error) {
    return performanceFailure(error, "gagal menambah aspek");
  }
}
