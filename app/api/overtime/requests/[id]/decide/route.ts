import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  integerValue,
  overtimeFailure,
  overtimeStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/overtime/http";
import {
  decideOvertimeRequest,
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
    const decision = textValue(body.decision);
    const approvedMinutes = integerValue(body.approvedMinutes);
    const reason = textValue(body.reason);

    if (decision !== "Disetujui" && decision !== "Ditolak") {
      throw new OvertimeDataError("Keputusan tidak valid", 400);
    }
    if (decision === "Ditolak" && !reason) {
      throw new OvertimeDataError("Alasan penolakan wajib diisi", 400);
    }

    await decideOvertimeRequest(id, decision, approvedMinutes, reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return overtimeFailure(error, "gagal memutuskan lembur");
  }
}
