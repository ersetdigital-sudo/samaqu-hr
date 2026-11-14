import { PerformanceAspectsView } from "@/components/performance/performance-aspects-view";
import { requireRole } from "@/lib/auth/session";
import { listPerformanceAspects } from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export default async function PerformanceAspectsPage() {
  await requireRole(["hr_manager"]);
  const aspects = await listPerformanceAspects();
  return <PerformanceAspectsView initialAspects={aspects} />;
}
