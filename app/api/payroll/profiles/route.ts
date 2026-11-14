import { NextResponse } from "next/server";
import { payrollFailure, payrollStaffGuard } from "@/lib/payroll/http";
import { getPayrollProfiles } from "@/lib/payroll/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await payrollStaffGuard();
  if (guard.response) return guard.response;
  try {
    const profiles = await getPayrollProfiles();
    return NextResponse.json({ profiles }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return payrollFailure(error, "gagal memuat profil");
  }
}
