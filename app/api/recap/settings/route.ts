import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  readJsonObject,
  recapFailure,
  recapStaffGuard,
} from "@/lib/recap/http";
import {
  getRecapSettings,
  updateRecapSettings,
} from "@/lib/recap/repository";
import { RecapDataError } from "@/lib/recap/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await recapStaffGuard();
  if (guard.response) return guard.response;

  try {
    const settings = await getRecapSettings();
    return NextResponse.json(
      { settings },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return recapFailure(error, "gagal memuat pengaturan rekap");
  }
}

export async function PATCH(request: Request) {
  const guard = await recapStaffGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const raw = body.periodStartDay;
    const periodStartDay =
      typeof raw === "number" ? Math.trunc(raw) : Number.NaN;
    if (!Number.isInteger(periodStartDay) || periodStartDay < 1 || periodStartDay > 28) {
      throw new RecapDataError("Tanggal mulai periode harus 1–28", 400);
    }

    const settings = await updateRecapSettings(periodStartDay);
    return NextResponse.json(
      { settings },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return recapFailure(error, "gagal menyimpan pengaturan rekap");
  }
}
