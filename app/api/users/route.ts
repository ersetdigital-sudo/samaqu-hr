import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import {
  UserDataError,
  createUser,
  listEmployeeOptions,
  listRoleOptions,
  listUsers,
} from "@/lib/users/repository";
import { validateNewUser } from "@/lib/users/validation";
import type { NewUserInput } from "@/lib/users/types";
import type { Role } from "@/lib/navigation";

export const dynamic = "force-dynamic";

const fail = (error: unknown) => {
  if (error instanceof UserDataError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[users] operasi gagal", error);
  return NextResponse.json({ error: "Terjadi kesalahan pada data pengguna" }, { status: 500 });
};

export async function GET() {
  const guard = await requireApiRole(["admin"]);
  if (guard.response) return guard.response;

  try {
    const [users, roles, employees] = await Promise.all([
      listUsers(),
      listRoleOptions(),
      listEmployeeOptions(),
    ]);

    return NextResponse.json(
      { users, roles, employees },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  const guard = await requireApiRole(["admin"]);
  if (guard.response) return guard.response;

  try {
    const body = (await request.json().catch(() => ({}))) as Partial<NewUserInput>;
    const errors = validateNewUser(body);

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const created = await createUser(
      {
        fullName: String(body.fullName),
        email: String(body.email),
        role: body.role as Role,
        employeeId: body.employeeId ?? null,
      },
      guard.user.id,
      new URL(request.url).origin
    );

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
