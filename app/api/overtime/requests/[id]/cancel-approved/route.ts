import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  overtimeFailure,
  overtimeStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/overtime/http";
import {
  cancelApprovedOvertimeRequest,
  OvertimeDataError,
} from "@/lib/overtime/repository";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await overtimeStaffGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const { id } = await params;
    assertUuid(id);

    const body = await readJsonObject(request);
    const reason = textValue(body.reason);
    if (!reason) {
      throw new OvertimeDataError("Alasan pembatalan wajib diisi", 400);
    }

    await cancelApprovedOvertimeRequest(id, reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return overtimeFailure(error, "gagal membatalkan lembur disetujui");
  }
}
