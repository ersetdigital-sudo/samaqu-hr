import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import {
  assertSameOrigin,
  readJson,
  recruitmentFailure,
} from "@/lib/recruitment/live/http";
import {
  normalizeContactInput,
} from "@/lib/recruitment/live/contact";
import { updateApplicationContact } from "@/lib/recruitment/live/repository";
import type { ApplicationContactInput } from "@/lib/recruitment/live/types";
import { validateApplicationContact } from "@/lib/recruitment/live/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiRole(["hr_manager", "recruiter"]);
  if (guard.response) return guard.response;

  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const record =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : {};

    const errors = validateApplicationContact(record);
    if (Object.keys(errors).length > 0)
      return NextResponse.json(
        { errors, error: "Periksa kembali isian data pelamar" },
        { status: 400 }
      );

    const input: ApplicationContactInput = {
      full_name: String(record.full_name),
      whatsapp: String(record.whatsapp),
      email: String(record.email),
      city: String(record.city),
    };

    const { id } = await params;
    return NextResponse.json(
      { contact: await updateApplicationContact(id, normalizeContactInput(input)) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return recruitmentFailure(error);
  }
}
