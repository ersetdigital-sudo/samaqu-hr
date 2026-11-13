import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  leaveFailure,
  leaveStaffGuard,
  readJsonObject,
  textValue,
} from "@/lib/leave/http";
import {
  decideLeaveRequest,
  LeaveDataError,
} from "@/lib/leave/repository";
import type { LeaveDecision } from "@/lib/leave/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await leaveStaffGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const { id } = await params;
    assertUuid(id);

    const body = await readJsonObject(request);
    const decision = textValue(body.decision) as LeaveDecision;
    const reason = textValue(body.reason);
    if (decision !== "Disetujui" && decision !== "Ditolak") {
      throw new LeaveDataError("Keputusan tidak valid", 400);
    }
    if (decision === "Ditolak" && !reason) {
      throw new LeaveDataError("Alasan penolakan wajib diisi", 400);
    }

    await decideLeaveRequest(id, decision, reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return leaveFailure(error, "gagal memutuskan cuti");
  }
}
