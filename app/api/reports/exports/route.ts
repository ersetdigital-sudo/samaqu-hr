import { NextResponse } from "next/server";
import {
  dateParam,
  reportFailure,
  reportStaffGuard,
} from "@/lib/reports/http";
import { listReportExports } from "@/lib/reports/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await reportStaffGuard();
  if (guard.response) return guard.response;
  try {
    const url = new URL(request.url);
    const from = dateParam(url.searchParams.get("from"), "");
    const to = dateParam(url.searchParams.get("to"), "");
    return NextResponse.json(
      { logs: await listReportExports({ from, to }) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return reportFailure(error, "gagal memuat riwayat ekspor");
  }
}
