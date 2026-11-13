import { NextResponse } from "next/server";
import { isoDateJakarta } from "@/lib/datetime";
import {
  leaveFailure,
  leaveStaffGuard,
  monthParam,
} from "@/lib/leave/http";
import { getLeaveCalendar } from "@/lib/leave/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await leaveStaffGuard();
  if (guard.response) return guard.response;

  try {
    const month = monthParam(
      new URL(request.url).searchParams.get("month"),
      isoDateJakarta().slice(0, 7)
    );
    const data = await getLeaveCalendar(month);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return leaveFailure(error, "gagal memuat kalender cuti");
  }
}
