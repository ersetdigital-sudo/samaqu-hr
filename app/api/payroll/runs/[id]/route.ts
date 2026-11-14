import { NextResponse } from "next/server";
import {
  assertUuid,
  payrollFailure,
  payrollStaffGuard,
} from "@/lib/payroll/http";
import { getPayrollRunDetail } from "@/lib/payroll/repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await payrollStaffGuard();
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    assertUuid(id);
    const detail = await getPayrollRunDetail(id);
    if (!detail) {
      return NextResponse.json(
        { error: "Payroll run tidak ditemukan" },
        { status: 404 }
      );
    }
    return NextResponse.json(detail, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return payrollFailure(error, "gagal memuat run");
  }
}
