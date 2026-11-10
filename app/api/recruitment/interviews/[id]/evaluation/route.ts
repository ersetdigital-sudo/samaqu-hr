import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import {
  assertSameOrigin,
  readJson,
  recruitmentFailure,
} from "@/lib/recruitment/live/http";
import { saveInterviewEvaluation } from "@/lib/recruitment/live/interviews";
import {
  evaluationErrors,
  parseEvaluationInput,
} from "@/lib/recruitment/live/interview-validation";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRole(["hr_manager", "recruiter"]);
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const { id } = await params;
    const body = await readJson(request);
    const errors = evaluationErrors(body);
    if (Object.keys(errors).length)
      return NextResponse.json({ errors }, { status: 400 });

    return NextResponse.json(
      { interview: await saveInterviewEvaluation(id, parseEvaluationInput(body)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}
