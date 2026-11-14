import { PayrollOverviewView } from "@/components/payroll/payroll-overview-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { listPayrollRuns } from "@/lib/payroll/repository";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  await requireRole(["hr_manager"]);
  const runs = await listPayrollRuns();
  return (
    <PayrollOverviewView initialRuns={runs} todayIso={isoDateJakarta()} />
  );
}
