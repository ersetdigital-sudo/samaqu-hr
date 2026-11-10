import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import {
  assertSameOrigin,
  readJson,
  recruitmentFailure,
} from "@/lib/recruitment/live/http";
import { startOnboarding } from "@/lib/onboarding/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await requireApiRole(["hr_manager"]);
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const record =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : {};
    if (typeof record.employee_id !== "string")
      return NextResponse.json(
        { error: "Karyawan wajib dipilih" },
        { status: 400 },
      );

    return NextResponse.json(
      { entry: await startOnboarding(record.employee_id) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}
