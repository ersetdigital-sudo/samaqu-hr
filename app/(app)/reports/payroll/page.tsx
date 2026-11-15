import { ReportsPayrollView } from "@/components/reports/reports-payroll-view";
import { requireRole } from "@/lib/auth/session";
import { getPayrollReport } from "@/lib/reports/repository";

export const dynamic = "force-dynamic";

export default async function ReportsPayrollPage() {
  await requireRole(["hr_manager"]);
  const data = await getPayrollReport(null);
  return <ReportsPayrollView initialData={data} />;
}
