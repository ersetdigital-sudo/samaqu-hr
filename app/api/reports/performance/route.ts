import { NextResponse } from "next/server";
import { reportFailure, reportStaffGuard } from "@/lib/reports/http";
import { getPerformanceReportData } from "@/lib/reports/repository";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const guard = await reportStaffGuard();
  if (guard.response) return guard.response;
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get("period");
    const period = raw && UUID.test(raw) ? raw : null;
    return NextResponse.json(
      { data: await getPerformanceReportData(period) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return reportFailure(error, "gagal memuat laporan performance");
  }
}
