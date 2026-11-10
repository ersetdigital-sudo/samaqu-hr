import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import {
  assertSameOrigin,
  readJson,
  recruitmentFailure,
} from "@/lib/recruitment/live/http";
import {
  deleteOnboardingItem,
  updateOnboardingItem,
} from "@/lib/onboarding/repository";
import type { OnboardingItemPatch } from "@/lib/onboarding/types";

export const dynamic = "force-dynamic";

export async function PATCH(
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

    const patch: OnboardingItemPatch = {};
    if (record.done !== undefined)
      patch.done = record.done as boolean;
    if (record.completedOn !== undefined)
      patch.completedOn = record.completedOn as string | null;
    if (record.notes !== undefined)
      patch.notes = record.notes as string;

    const { id } = await params;
    return NextResponse.json(
      { item: await updateOnboardingItem(id, patch) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRole(["hr_manager"]);
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const { id } = await params;
    await deleteOnboardingItem(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return recruitmentFailure(error);
  }
}
