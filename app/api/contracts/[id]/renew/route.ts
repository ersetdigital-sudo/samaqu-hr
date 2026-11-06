import { NextResponse } from "next/server";
import { renewContract } from "@/lib/contracts/repository";
import type { RenewInput } from "@/lib/contracts/types";
import { contractErrorResponse, contractsGuard } from "@/lib/contracts/http";

export const dynamic = "force-dynamic";

/** Perpanjangan selalu membuat kontrak baru yang menunjuk kontrak lama. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await contractsGuard();
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const body = (await request.json()) as RenewInput;

    // Tanggal mulai boleh kosong: server memakai sehari setelah kontrak lama
    // berakhir. Perubahan manual wajib menyertakan alasan jeda.
    const contract = await renewContract(id, {
      startDate: body.startDate ?? null,
      endDate: body.endDate,
      note: body.note,
      gapReason: body.gapReason ?? null,
    });

    return NextResponse.json({ contract }, { status: 201 });
  } catch (error) {
    return contractErrorResponse(error, "gagal memperpanjang kontrak");
  }
}
