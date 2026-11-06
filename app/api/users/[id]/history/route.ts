import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import { UserDataError, getUserHistory } from "@/lib/users/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireApiRole(["admin"]);
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const history = await getUserHistory(id);
    return NextResponse.json(
      { history },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof UserDataError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[users] gagal memuat riwayat", error);
    return NextResponse.json({ error: "Gagal memuat riwayat" }, { status: 500 });
  }
}
