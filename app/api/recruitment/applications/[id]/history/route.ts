import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { recruitmentFailure } from "@/lib/recruitment/live/http";
import { listStageHistory } from "@/lib/recruitment/live/stage-history";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRole(["hr_manager", "recruiter"]);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    return NextResponse.json(
      { history: await listStageHistory(id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}
