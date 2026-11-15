import { NextResponse } from "next/server";
import { isoDateJakarta } from "@/lib/datetime";
import {
  monthParam,
  reportFailure,
  reportStaffGuard,
  textParam,
} from "@/lib/reports/http";
import { getAttendanceReport } from "@/lib/reports/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await reportStaffGuard();
  if (guard.response) return guard.response;
  try {
    const url = new URL(request.url);
    const month = monthParam(
      url.searchParams.get("month"),
      isoDateJakarta().slice(0, 7)
    );
    const department = textParam(url.searchParams.get("department"), "Semua");
    return NextResponse.json(
      { data: await getAttendanceReport(month, department) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return reportFailure(error, "gagal memuat laporan kehadiran");
  }
}
