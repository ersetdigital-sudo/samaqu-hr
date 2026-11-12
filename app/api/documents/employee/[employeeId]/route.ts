import { NextResponse } from "next/server";
import { documentFailure, documentsStaffGuard } from "@/lib/documents/http";
import { getEmployeeDocuments } from "@/lib/documents/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const guard = await documentsStaffGuard();
  if (guard.response) return guard.response;

  try {
    const { employeeId } = await params;
    const data = await getEmployeeDocuments(employeeId);

    if (!data) {
      return NextResponse.json(
        { error: "Karyawan tidak ditemukan" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return documentFailure(error, "gagal memuat dokumen karyawan");
  }
}
