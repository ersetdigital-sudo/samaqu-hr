/**
 * Endpoint snapshot rekrutmen untuk klien (refresh/retry).
 *
 * Route ini hanya meneruskan hasil lapisan data server. Ketika sumber data
 * diganti ke database, tidak ada perubahan yang perlu dilakukan di sini.
 */

import { NextResponse } from "next/server";
import { getRecruitmentSnapshot } from "@/lib/recruitment/repository";
import { requireApiModule } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireApiModule("recruitment");
  if (guard.response) return guard.response;

  try {
    const snapshot = await getRecruitmentSnapshot();
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[recruitment] gagal memuat snapshot", error);
    return NextResponse.json(
      { error: "Gagal memuat data rekrutmen" },
      { status: 500 }
    );
  }
}
