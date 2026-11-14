import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  payrollFailure,
  payrollStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/payroll/http";
import {
  getPayrollSettings,
  savePayrollSettings,
} from "@/lib/payroll/repository";
import { validatePayrollSettings } from "@/lib/payroll/rules";
import { PayrollDataError } from "@/lib/payroll/repository";
import type { PayrollSettings } from "@/lib/payroll/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await payrollStaffGuard();
  if (guard.response) return guard.response;
  try {
    const data = await getPayrollSettings();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return payrollFailure(error, "gagal memuat pengaturan");
  }
}

export async function PATCH(request: Request) {
  const guard = await payrollStaffGuard();
  if (guard.response) return guard.response;
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const settings = body.settings as PayrollSettings | undefined;
    const effectiveDate = textValue(body.effectiveDate);
    const reason = textValue(body.reason);
    if (!settings || typeof settings !== "object") {
      throw new PayrollDataError("Data pengaturan tidak valid", 400);
    }
    const errors = validatePayrollSettings(settings);
    if (errors.length > 0) {
      throw new PayrollDataError(errors[0], 400);
    }
    if (!effectiveDate) {
      throw new PayrollDataError("Tanggal berlaku wajib diisi", 400);
    }
    if (!reason) {
      throw new PayrollDataError("Alasan perubahan wajib diisi", 400);
    }
    await savePayrollSettings(settings, effectiveDate, reason);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return payrollFailure(error, "gagal menyimpan pengaturan");
  }
}
