import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { UserDataError, resendInvite } from "@/lib/users/repository";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiRole(["admin"]);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    await resendInvite(id, new URL(request.url).origin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UserDataError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[users] gagal mengirim ulang undangan", error);
    return NextResponse.json({ error: "Gagal mengirim undangan" }, { status: 500 });
  }
}
