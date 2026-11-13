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
  cancelApprovedLeaveRequest,
  LeaveDataError,
} from "@/lib/leave/repository";

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
    const reason = textValue(body.reason);
    if (!reason) {
      throw new LeaveDataError("Alasan pembatalan wajib diisi", 400);
    }

    await cancelApprovedLeaveRequest(id, reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return leaveFailure(error, "gagal membatalkan cuti yang disetujui");
  }
}
