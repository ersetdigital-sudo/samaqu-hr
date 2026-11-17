import { NotificationSettingsView } from "@/components/notifications/notification-settings-view";
import { requireRole } from "@/lib/auth/session";
import { getNotificationSettings } from "@/lib/notifications/repository";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  await requireRole(["hr_manager"]);
  const categories = await getNotificationSettings();
  return <NotificationSettingsView initialCategories={categories} />;
}
