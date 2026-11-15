import { NextResponse } from "next/server";
import {
  reportFailure,
  reportStaffGuard,
} from "@/lib/reports/http";
import { getPayrollReport } from "@/lib/reports/repository";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const guard = await reportStaffGuard();
  if (guard.response) return guard.response;
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get("period");
    const period = raw && DATE.test(raw) ? raw : null;
    return NextResponse.json(
      { data: await getPayrollReport(period) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return reportFailure(error, "gagal memuat laporan payroll");
  }
}
