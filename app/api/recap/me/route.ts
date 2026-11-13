import { NextResponse } from "next/server";
import { isoDateJakarta } from "@/lib/datetime";
import {
  recapFailure,
  recapMonthParam,
  recapSelfGuard,
} from "@/lib/recap/http";
import { getMyRecap } from "@/lib/recap/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await recapSelfGuard();
  if (guard.response) return guard.response;

  try {
    const month = recapMonthParam(
      new URL(request.url).searchParams.get("month"),
      isoDateJakarta().slice(0, 7)
    );
    const data = await getMyRecap(month);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return recapFailure(error, "gagal memuat rekap karyawan");
  }
}
