import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  payrollFailure,
  payrollStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/payroll/http";
import { reviseAndCalculatePayrollRun } from "@/lib/payroll/service";

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
    const body = await readJsonObject(request);
    const reason = textValue(body.reason);
    if (!reason) {
      return NextResponse.json(
        { error: "Alasan revisi wajib diisi" },
        { status: 400 }
      );
    }
    const newRunId = await reviseAndCalculatePayrollRun(id, reason);
    return NextResponse.json({ runId: newRunId }, { status: 201 });
  } catch (error) {
    return payrollFailure(error, "gagal merevisi payroll");
  }
}
