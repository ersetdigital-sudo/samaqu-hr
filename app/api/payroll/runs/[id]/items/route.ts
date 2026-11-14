import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  numberValue,
  payrollFailure,
  payrollStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/payroll/http";
import { PayrollDataError } from "@/lib/payroll/repository";
import { addPayrollItemAndRecalculate } from "@/lib/payroll/service";

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
    const employeeId = textValue(body.employeeId);
    const category = textValue(body.category);
    const label = textValue(body.label);
    const amount = numberValue(body.amount);
    const reason = textValue(body.reason);
    if (!employeeId || !label || !reason) {
      throw new PayrollDataError("Karyawan, label, dan alasan wajib diisi", 400);
    }
    if (category !== "Pendapatan" && category !== "Potongan") {
      throw new PayrollDataError("Kategori item tidak valid", 400);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new PayrollDataError("Nominal item harus lebih dari 0", 400);
    }
    await addPayrollItemAndRecalculate(
      id,
      employeeId,
      category,
      label,
      amount,
      reason
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return payrollFailure(error, "gagal menambah item payroll");
  }
}
