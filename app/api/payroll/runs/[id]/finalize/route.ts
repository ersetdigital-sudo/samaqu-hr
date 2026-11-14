import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  payrollFailure,
  payrollStaffGuard,
} from "@/lib/payroll/http";
import { finalizePayrollRun } from "@/lib/payroll/repository";

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
    await finalizePayrollRun(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return payrollFailure(error, "gagal finalisasi payroll");
  }
}
