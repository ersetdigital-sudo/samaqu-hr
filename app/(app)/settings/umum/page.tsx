import { RecapSettingsView } from "@/components/recap/recap-settings-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { getRecapSettings } from "@/lib/recap/repository";

export const dynamic = "force-dynamic";

export default async function GeneralSettingsPage() {
  await requireRole(["hr_manager"]);
  const settings = await getRecapSettings();

  return (
    <RecapSettingsView
      initialSettings={settings}
      todayIso={isoDateJakarta()}
    />
  );
}
