import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  performanceFailure,
  performanceStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/performance/http";
import {
  createPerformancePeriod,
  listPerformancePeriods,
  PerformanceDataError,
} from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const guard = await performanceStaffGuard();
  if (guard.response) return guard.response;
  try {
    const periods = await listPerformancePeriods();
    return NextResponse.json(
      { periods },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return performanceFailure(error, "gagal memuat periode");
  }
}

export async function POST(request: Request) {
  const guard = await performanceStaffGuard();
  if (guard.response) return guard.response;
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const name = textValue(body.name);
    const startDate = textValue(body.startDate);
    const endDate = textValue(body.endDate);
    const dueDate = textValue(body.dueDate);
    if (!name || !ISO_DATE.test(startDate) || !ISO_DATE.test(endDate) || !ISO_DATE.test(dueDate)) {
      throw new PerformanceDataError("Nama dan tanggal periode wajib diisi", 400);
    }
    await createPerformancePeriod({ name, startDate, endDate, dueDate });
    const periods = await listPerformancePeriods();
    return NextResponse.json({ ok: true, periods }, { status: 201 });
  } catch (error) {
    return performanceFailure(error, "gagal membuka periode");
  }
}
