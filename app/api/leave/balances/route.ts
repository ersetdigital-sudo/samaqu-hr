import { NextResponse } from "next/server";
import { isoDateJakarta } from "@/lib/datetime";
import {
  leaveFailure,
  leaveStaffGuard,
  yearParam,
} from "@/lib/leave/http";
import { getLeaveBalances } from "@/lib/leave/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await leaveStaffGuard();
  if (guard.response) return guard.response;

  try {
    const year = yearParam(
      new URL(request.url).searchParams.get("year"),
      Number(isoDateJakarta().slice(0, 4))
    );
    const data = await getLeaveBalances(year);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return leaveFailure(error, "gagal memuat saldo cuti");
  }
}
