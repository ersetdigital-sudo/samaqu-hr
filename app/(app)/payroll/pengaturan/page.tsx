import { PayrollSettingsView } from "@/components/payroll/payroll-settings-view";
import { requireRole } from "@/lib/auth/session";
import {
  getPayrollSettings,
  getPayrollTerRates,
} from "@/lib/payroll/repository";

export const dynamic = "force-dynamic";

export default async function PayrollSettingsPage() {
  await requireRole(["hr_manager"]);
  const [data, terRates] = await Promise.all([
    getPayrollSettings(),
    getPayrollTerRates(),
  ]);
  return <PayrollSettingsView initialData={data} terRates={terRates} />;
}
