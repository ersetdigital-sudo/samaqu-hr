import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import {
  assertSameOrigin,
  readJson,
  recruitmentFailure,
} from "@/lib/recruitment/live/http";
import {
  getCandidateApplication,
  updateApplication,
} from "@/lib/recruitment/live/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRole(["hr_manager", "recruiter"]);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const application = await getCandidateApplication(id);
    if (!application)
      return NextResponse.json(
        { error: "Pelamar tidak ditemukan" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.json(
      { application },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRole(["hr_manager", "recruiter"]);
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const { id } = await params;
    return NextResponse.json(
      { application: await updateApplication(id, await readJson(request)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}
