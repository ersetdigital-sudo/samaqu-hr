import { NextResponse } from "next/server";
import { isoDateJakarta } from "@/lib/datetime";
import {
  leaveFailure,
  leaveSelfGuard,
  yearParam,
} from "@/lib/leave/http";
import { getMyLeaveData } from "@/lib/leave/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await leaveSelfGuard();
  if (guard.response) return guard.response;

  try {
    const year = yearParam(
      new URL(request.url).searchParams.get("year"),
      Number(isoDateJakarta().slice(0, 4))
    );
    const data = await getMyLeaveData(year);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return leaveFailure(error, "gagal memuat cuti karyawan");
  }
}
