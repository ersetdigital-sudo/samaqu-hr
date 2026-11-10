import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import {
  assertSameOrigin,
  readJson,
  recruitmentFailure,
} from "@/lib/recruitment/live/http";
import {
  updateInterviewSchedule,
  updateInterviewStatus,
} from "@/lib/recruitment/live/interviews";
import {
  interviewErrors,
  isInterviewStatus,
  parseInterviewInput,
} from "@/lib/recruitment/live/interview-validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRole(["hr_manager", "recruiter"]);
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const { id } = await params;
    const body = await readJson(request);
    const record =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : {};

    if ("status" in record && Object.keys(record).length === 1) {
      if (!isInterviewStatus(record.status))
        return NextResponse.json(
          { error: "Status wawancara tidak valid" },
          { status: 400 },
        );
      return NextResponse.json(
        { interview: await updateInterviewStatus(id, record.status) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const errors = interviewErrors(record);
    if (Object.keys(errors).length)
      return NextResponse.json({ errors }, { status: 400 });

    return NextResponse.json(
      await updateInterviewSchedule(id, parseInterviewInput(record)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}
