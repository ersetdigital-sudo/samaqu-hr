import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  leaveFailure,
  leaveSelfGuard,
} from "@/lib/leave/http";
import { cancelOwnLeaveRequest } from "@/lib/leave/repository";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await leaveSelfGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const { id } = await params;
    assertUuid(id);
    await cancelOwnLeaveRequest(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return leaveFailure(error, "gagal membatalkan cuti");
  }
}
