import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import {
  assertSameOrigin,
  readJson,
  recruitmentFailure,
} from "@/lib/recruitment/live/http";
import { addOnboardingItem } from "@/lib/onboarding/repository";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRole(["hr_manager"]);
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const record =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : {};
    if (typeof record.label !== "string")
      return NextResponse.json(
        { error: "Nama item wajib diisi" },
        { status: 400 },
      );

    const { id } = await params;
    return NextResponse.json(
      { item: await addOnboardingItem(id, record.label) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}
