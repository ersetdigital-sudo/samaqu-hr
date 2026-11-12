import { NextResponse } from "next/server";
import { isoDateJakarta } from "@/lib/datetime";
import {
  attendanceFailure,
  attendanceStaffGuard,
  dateParam,
} from "@/lib/attendance/http";
import { getDailyAttendance } from "@/lib/attendance/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await attendanceStaffGuard();
  if (guard.response) return guard.response;

  try {
    const date = dateParam(
      new URL(request.url).searchParams.get("date"),
      isoDateJakarta()
    );
    const data = await getDailyAttendance(date);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return attendanceFailure(error);
  }
}
