import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  assertUuid,
  overtimeFailure,
  overtimeSelfGuard,
} from "@/lib/overtime/http";
import { cancelOwnOvertimeRequest } from "@/lib/overtime/repository";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await overtimeSelfGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const { id } = await params;
    assertUuid(id);
    await cancelOwnOvertimeRequest(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return overtimeFailure(error, "gagal membatalkan lembur");
  }
}
