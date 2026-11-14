import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  monthFromParam,
  payrollFailure,
  payrollStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/payroll/http";
import { createAndCalculatePayrollRun } from "@/lib/payroll/service";
import { listPayrollRuns } from "@/lib/payroll/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await payrollStaffGuard();
  if (guard.response) return guard.response;
  try {
    const runs = await listPayrollRuns();
    return NextResponse.json({ runs }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return payrollFailure(error, "gagal memuat run");
  }
}

export async function POST(request: Request) {
  const guard = await payrollStaffGuard();
  if (guard.response) return guard.response;
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const rawPeriod = textValue(body.periodMonth);
    if (!rawPeriod) {
      return NextResponse.json(
        { error: "Periode payroll wajib diisi" },
        { status: 400 }
      );
    }
    const period = monthFromParam(rawPeriod, "");
    if (!period) {
      return NextResponse.json(
        { error: "Periode payroll tidak valid" },
        { status: 400 }
      );
    }
    const runId = await createAndCalculatePayrollRun(period);
    return NextResponse.json({ runId }, { status: 201 });
  } catch (error) {
    return payrollFailure(error, "gagal membuat run");
  }
}
