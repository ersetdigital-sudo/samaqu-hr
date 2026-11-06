import { NextResponse } from "next/server";
import { getEmployeeContracts } from "@/lib/contracts/repository";
import { contractErrorResponse, contractsGuard } from "@/lib/contracts/http";

export const dynamic = "force-dynamic";

/** Detail kontrak per karyawan: data ringkas + riwayat + audit trail. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const guard = await contractsGuard();
  if (guard.response) return guard.response;

  try {
    const { employeeId } = await params;
    const detail = await getEmployeeContracts(employeeId);

    if (!detail) {
      return NextResponse.json(
        { error: "Karyawan tidak ditemukan di Direktori" },
        { status: 404 }
      );
    }

    return NextResponse.json(detail, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return contractErrorResponse(error, "gagal memuat detail kontrak");
  }
}
