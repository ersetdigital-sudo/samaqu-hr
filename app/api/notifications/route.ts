import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/guard";
import { notificationFailure } from "@/lib/notifications/http";
import { getNotifications } from "@/lib/notifications/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireApiUser();
  if (guard.response) return guard.response;
  try {
    const items = await getNotifications(false);
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return notificationFailure(error, "gagal memuat notifikasi");
  }
}
