import { NextResponse } from "next/server";
import {
  reportFailure,
  reportStaffGuard,
  textParam,
} from "@/lib/reports/http";
import { getEmployeeExportData } from "@/lib/reports/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await reportStaffGuard();
  if (guard.response) return guard.response;
  try {
    const url = new URL(request.url);
    const status = textParam(url.searchParams.get("status"), "Semua");
    const department = textParam(url.searchParams.get("department"), "Semua");
    return NextResponse.json(
      { data: await getEmployeeExportData(status, department) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return reportFailure(error, "gagal memuat daftar karyawan");
  }
}
