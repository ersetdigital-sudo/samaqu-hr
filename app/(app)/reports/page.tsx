import { ReportsOverviewView } from "@/components/reports/reports-overview-view";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireRole(["hr_manager", "recruiter"]);
  return <ReportsOverviewView role={user.role} />;
}
