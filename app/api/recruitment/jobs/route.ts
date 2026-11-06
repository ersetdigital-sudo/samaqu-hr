import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { listJobs, saveJob } from "@/lib/recruitment/live/repository";
import {
  assertSameOrigin,
  readJson,
  recruitmentFailure,
} from "@/lib/recruitment/live/http";

export const dynamic = "force-dynamic";
export async function GET() {
  const guard = await requireApiRole(["hr_manager", "recruiter"]);
  if (guard.response) return guard.response;
  try {
    return NextResponse.json(
      { jobs: await listJobs() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}
export async function POST(request: Request) {
  const guard = await requireApiRole(["hr_manager", "recruiter"]);
  if (guard.response) return guard.response;
  try {
    assertSameOrigin(request);
    return NextResponse.json(
      { job: await saveJob(await readJson(request), guard.user.id) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}
