import { NextResponse } from "next/server";
import {
  positionHistoryFailure,
  positionHistoryGuard,
} from "@/lib/position-history/http";
import { getEmployeePositionHistory } from "@/lib/position-history/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const guard = await positionHistoryGuard();
  if (guard.response) return guard.response;

  try {
    const { employeeId } = await params;
    const history = await getEmployeePositionHistory(employeeId);
    return NextResponse.json(
      { history },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return positionHistoryFailure(error);
  }
}
