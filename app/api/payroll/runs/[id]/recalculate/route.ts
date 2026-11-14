import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  payrollFailure,
  payrollStaffGuard,
} from "@/lib/payroll/http";
import { recalculatePayrollRun } from "@/lib/payroll/service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await payrollStaffGuard();
  if (guard.response) return guard.response;
  try {
    assertSameOrigin(request);
    const { id } = await params;
    assertUuid(id);
    await recalculatePayrollRun(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return payrollFailure(error, "gagal menghitung ulang payroll");
  }
}
