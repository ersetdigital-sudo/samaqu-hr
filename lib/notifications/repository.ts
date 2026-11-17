/** Akses data notifikasi in-app. */

import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  notificationCategoryDefinition,
} from "@/lib/notifications/categories";
import type {
  NotificationItem,
  NotificationSettingsItem,
} from "@/lib/notifications/types";

export type NotificationTechnicalError = {
  code?: string;
  functionName?: string;
  message?: string;
};

export class NotificationDataError extends Error {
  readonly status: number;
  readonly technical?: NotificationTechnicalError;
  constructor(
    message: string,
    status = 400,
    technical?: NotificationTechnicalError
  ) {
    super(message);
    this.name = "NotificationDataError";
    this.status = status;
    this.technical = technical;
  }
}

const mapDbError = (
  error: { code?: string; message?: string },
  action: string
) => {
  if (error.code === "42501") {
    return new NotificationDataError("Akses ditolak", 403);
  }
  return new NotificationDataError(
    `Gagal ${action} notifikasi`,
    500,
    { code: error.code, message: error.message }
  );
};

const mapRpcError = (
  error: { code?: string; message?: string },
  functionName: string
) => {
  const message = error.message?.trim() || "Gagal memuat notifikasi";
  if (error.code === "42501") {
    return new NotificationDataError(message, 403);
  }
  if (error.code === "P0002") {
    return new NotificationDataError(message, 404);
  }
  if (error.code === "P0001") {
    return new NotificationDataError(message, 400);
  }
  return new NotificationDataError(
    "Gagal memuat notifikasi",
    500,
    { code: error.code, functionName, message }
  );
};

export async function getNotifications(
  includeDisabled = false
): Promise<NotificationItem[]> {
  const { data, error } = await (await getServerSupabase()).rpc(
    "notifications_for_current_user",
    { p_include_disabled: includeDisabled }
  );
  if (error) {
    throw mapRpcError(error, "notifications_for_current_user");
  }
  return ((data ?? []) as {
    category: string;
    title: string;
    detail: string;
    href: string;
    item_count: number;
    enabled: boolean;
    sort_order: number;
  }[]).map((row) => ({
    category: row.category,
    title: row.title,
    detail: row.detail,
    href: row.href,
    itemCount: row.item_count,
    enabled: row.enabled,
    sortOrder: row.sort_order,
  }));
}

export async function getNotificationSettings(): Promise<
  NotificationSettingsItem[]
> {
  const items = await getNotifications(true);
  return items.map((item) => {
    const definition = notificationCategoryDefinition(item.category);
    return {
      ...item,
      label: definition?.label ?? item.title,
      description: definition?.description ?? "",
    };
  });
}

export async function setNotificationPref(
  userId: string,
  category: string,
  enabled: boolean
): Promise<void> {
  const { error } = await (await getServerSupabase())
    .from("user_notification_prefs")
    .upsert(
      { user_id: userId, category, enabled },
      { onConflict: "user_id,category" }
    );
  if (error) throw mapDbError(error, "menyimpan preferensi");
}
