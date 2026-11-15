import { ReportsPerformanceView } from "@/components/reports/reports-performance-view";
import { requireRole } from "@/lib/auth/session";
import { getPerformanceReportData } from "@/lib/reports/repository";

export const dynamic = "force-dynamic";

export default async function ReportsPerformancePage() {
  await requireRole(["hr_manager"]);
  const data = await getPerformanceReportData(null);
  return <ReportsPerformanceView initialData={data} />;
}
