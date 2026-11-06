import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { getJob, listApplications } from "@/lib/recruitment/live/repository";
import {
  RecruitmentError,
  recruitmentFailure,
} from "@/lib/recruitment/live/http";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRole(["hr_manager", "recruiter"]);
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    if (!(await getJob(id)))
      throw new RecruitmentError("Lowongan tidak ditemukan", 404);
    const q = new URL(request.url).searchParams;
    return NextResponse.json(
      await listApplications(id, {
        search: q.get("search") ?? "",
        stage: q.get("stage") ?? "",
        page: Number(q.get("page") ?? 1),
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}
