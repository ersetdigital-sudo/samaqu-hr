import { NextResponse } from "next/server";
import { isoDateJakarta } from "@/lib/datetime";
import {
  dateParam,
  reportFailure,
  reportStaffGuard,
} from "@/lib/reports/http";
import { getHrReport } from "@/lib/reports/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await reportStaffGuard();
  if (guard.response) return guard.response;
  try {
    const url = new URL(request.url);
    const date = dateParam(url.searchParams.get("date"), isoDateJakarta());
    return NextResponse.json(
      { data: await getHrReport(date) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return reportFailure(error, "gagal memuat laporan HR");
  }
}
