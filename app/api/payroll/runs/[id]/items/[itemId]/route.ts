import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  payrollFailure,
  payrollStaffGuard,
} from "@/lib/payroll/http";
import { deletePayrollItemAndRecalculate } from "@/lib/payroll/service";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const guard = await payrollStaffGuard();
  if (guard.response) return guard.response;
  try {
    assertSameOrigin(request);
    const { id, itemId } = await params;
    assertUuid(id);
    assertUuid(itemId);
    await deletePayrollItemAndRecalculate(id, itemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return payrollFailure(error, "gagal menghapus item payroll");
  }
}
