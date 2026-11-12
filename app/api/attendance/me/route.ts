import { NextResponse } from "next/server";
import { isoDateJakarta } from "@/lib/datetime";
import {
  attendanceFailure,
  attendanceSelfGuard,
  monthParam,
} from "@/lib/attendance/http";
import { getMyAttendanceMonth } from "@/lib/attendance/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await attendanceSelfGuard();
  if (guard.response) return guard.response;

  try {
    const month = monthParam(
      new URL(request.url).searchParams.get("month"),
      isoDateJakarta().slice(0, 7)
    );
    const data = await getMyAttendanceMonth(month);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return attendanceFailure(error);
  }
}
