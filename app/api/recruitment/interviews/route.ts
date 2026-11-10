import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import {
  assertSameOrigin,
  readJson,
  recruitmentFailure,
} from "@/lib/recruitment/live/http";
import { createInterview } from "@/lib/recruitment/live/interviews";
import {
  interviewErrors,
  parseInterviewInput,
} from "@/lib/recruitment/live/interview-validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await requireApiRole(["hr_manager", "recruiter"]);
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const record =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : {};
    const applicationId = record.application_id;
    if (typeof applicationId !== "string")
      return NextResponse.json(
        { error: "Pelamar untuk jadwal ini tidak valid" },
        { status: 400 },
      );

    const errors = interviewErrors(record);
    if (Object.keys(errors).length)
      return NextResponse.json({ errors }, { status: 400 });

    return NextResponse.json(
      await createInterview(applicationId, parseInterviewInput(record)),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}
