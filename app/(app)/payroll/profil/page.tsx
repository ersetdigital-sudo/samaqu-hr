import { PayrollProfilesView } from "@/components/payroll/payroll-profiles-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { getPayrollProfiles } from "@/lib/payroll/repository";

export const dynamic = "force-dynamic";

export default async function PayrollProfilesPage() {
  await requireRole(["hr_manager"]);
  const profiles = await getPayrollProfiles();
  return (
    <PayrollProfilesView
      initialProfiles={profiles}
      todayIso={isoDateJakarta()}
    />
  );
}
