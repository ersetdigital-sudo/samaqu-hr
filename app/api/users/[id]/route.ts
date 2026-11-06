import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { UserDataError, updateUser } from "@/lib/users/repository";
import { validateUserUpdate } from "@/lib/users/validation";
import type { AccountStatus, UserUpdateInput } from "@/lib/users/types";
import type { Role } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiRole(["admin"]);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const errors = validateUserUpdate(body);

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const patch: UserUpdateInput = {};
    if (typeof body.fullName === "string") patch.fullName = body.fullName;
    if (typeof body.role === "string") patch.role = body.role as Role;
    if (typeof body.accountStatus === "string") {
      patch.accountStatus = body.accountStatus as AccountStatus;
    }
    if (body.employeeId === null || typeof body.employeeId === "string") {
      patch.employeeId = body.employeeId as string | null;
    }

    await updateUser(id, patch, guard.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UserDataError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[users] gagal memperbarui pengguna", error);
    return NextResponse.json({ error: "Gagal memperbarui pengguna" }, { status: 500 });
  }
}
