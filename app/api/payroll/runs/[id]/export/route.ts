import { NextResponse } from "next/server";
import {
  assertUuid,
  payrollFailure,
  payrollStaffGuard,
} from "@/lib/payroll/http";
import {
  getPayrollRunDetail,
  getPayrollTransferRows,
  PayrollDataError,
} from "@/lib/payroll/repository";
import {
  buildPayrollTransferXlsx,
  buildPayrollXlsx,
} from "@/lib/payroll/xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    if (!detail) throw new PayrollDataError("Payroll run tidak ditemukan", 404);

    const format = new URL(request.url).searchParams.get("format") ?? "xlsx";
    if (format !== "xlsx" && format !== "transfer") {
      throw new PayrollDataError("Format ekspor tidak valid", 400);
    }

    const period = detail.run.periodMonth.slice(0, 7);
    if (format === "transfer") {
      const rows = await getPayrollTransferRows(id);
      const buffer = await buildPayrollTransferXlsx(detail.run, rows);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="transfer-payroll-${period}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = await buildPayrollXlsx(detail.run, detail.employees);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="payroll-${period}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return payrollFailure(error, "gagal mengekspor payroll");
  }
}
