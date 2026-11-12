import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  attendanceFailure,
  attendanceSelfGuard,
} from "@/lib/attendance/http";
import { checkOut } from "@/lib/attendance/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await attendanceSelfGuard();
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const attendance = await checkOut();
    return NextResponse.json({ attendance });
  } catch (error) {
    return attendanceFailure(error);
  }
}
