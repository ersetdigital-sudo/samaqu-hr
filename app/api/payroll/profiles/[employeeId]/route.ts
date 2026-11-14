import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  numberValue,
  payrollFailure,
  payrollStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/payroll/http";
import {
  PayrollDataError,
  savePayrollProfile,
} from "@/lib/payroll/repository";
import { validatePayrollProfileInput } from "@/lib/payroll/rules";
import type {
  JkkRiskClass,
  PayrollProfileInput,
  PtkpStatus,
} from "@/lib/payroll/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const guard = await payrollStaffGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const { employeeId } = await params;
    const body = await readJsonObject(request);
    const input = body.profile as Record<string, unknown> | undefined;
    const reason = textValue(body.reason);
    if (!input || typeof input !== "object") {
      throw new PayrollDataError("Data profil payroll tidak valid", 400);
    }

    const profile: PayrollProfileInput = {
      baseSalary: numberValue(input.baseSalary),
      fixedAllowance: numberValue(input.fixedAllowance),
      variableAllowance: numberValue(input.variableAllowance),
      ptkpStatus: (textValue(input.ptkpStatus) || null) as PtkpStatus | null,
      npwp: textValue(input.npwp),
      bpjsKesehatanNumber: textValue(input.bpjsKesehatanNumber),
      bpjsKetenagakerjaanNumber: textValue(input.bpjsKetenagakerjaanNumber),
      bankName: textValue(input.bankName),
      bankAccountNumber: textValue(input.bankAccountNumber),
      bankAccountHolder: textValue(input.bankAccountHolder),
      jkkRiskClass: (textValue(input.jkkRiskClass) || "very_low") as JkkRiskClass,
      effectiveDate: textValue(input.effectiveDate),
      notes: textValue(input.notes),
    };

    const errors = validatePayrollProfileInput({
      baseSalary: profile.baseSalary,
      fixedAllowance: profile.fixedAllowance,
      variableAllowance: profile.variableAllowance,
      ptkpStatus: profile.ptkpStatus,
      jkkRiskClass: profile.jkkRiskClass,
      effectiveDate: profile.effectiveDate,
    });
    if (Object.keys(errors).length > 0) {
      throw new PayrollDataError(
        "Periksa kembali isian profil payroll",
        400,
        errors
      );
    }
    if (!reason) {
      throw new PayrollDataError("Alasan perubahan profil wajib diisi", 400);
    }

    await savePayrollProfile(employeeId, profile, reason);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return payrollFailure(error, "gagal menyimpan profil payroll");
  }
}
