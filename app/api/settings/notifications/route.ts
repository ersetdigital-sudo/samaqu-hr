import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guard";
import {
  assertSameOrigin,
  notificationFailure,
  readJsonObject,
} from "@/lib/notifications/http";
import { notificationCategoryDefinition } from "@/lib/notifications/categories";
import {
  getNotificationSettings,
  NotificationDataError,
  setNotificationPref,
} from "@/lib/notifications/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireApiRole(["hr_manager"]);
  if (guard.response) return guard.response;
  try {
    const categories = await getNotificationSettings();
    return NextResponse.json(
      { categories },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return notificationFailure(error, "gagal memuat pengaturan notifikasi");
  }
}

export async function PATCH(request: Request) {
  const guard = await requireApiRole(["hr_manager"]);
  if (guard.response) return guard.response;
  try {
    assertSameOrigin(request);
    const body = await readJsonObject(request);
    const category =
      typeof body.category === "string" ? body.category.trim() : "";
    const enabled = body.enabled;
    if (!notificationCategoryDefinition(category)) {
      throw new NotificationDataError("Kategori notifikasi tidak valid", 400);
    }
    if (typeof enabled !== "boolean") {
      throw new NotificationDataError("Status notifikasi tidak valid", 400);
    }
    await setNotificationPref(guard.user.id, category, enabled);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return notificationFailure(error, "gagal menyimpan preferensi notifikasi");
  }
}
