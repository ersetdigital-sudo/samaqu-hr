import { NextResponse } from "next/server";
import { performanceFailure, performanceStaffGuard } from "@/lib/performance/http";
import { getEmployeePerformanceHistory } from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const guard = await performanceStaffGuard();
  if (guard.response) return guard.response;
  try {
    const { employeeId } = await params;
    const history = await getEmployeePerformanceHistory(employeeId);
    return NextResponse.json(
      { history },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return performanceFailure(error, "gagal memuat performa karyawan");
  }
}
