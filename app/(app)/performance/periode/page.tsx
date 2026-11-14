import { PerformancePeriodsView } from "@/components/performance/performance-periods-view";
import { requireRole } from "@/lib/auth/session";
import { listPerformancePeriods } from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export default async function PerformancePeriodsPage() {
  await requireRole(["hr_manager"]);
  const periods = await listPerformancePeriods();
  return <PerformancePeriodsView initialPeriods={periods} />;
}
