import { redirect } from "next/navigation";
import { PerformancePeriodsView } from "@/components/performance/performance-periods-view";
import { requireUser } from "@/lib/auth/session";
import { getPerformanceTeamRows, listPerformancePeriods } from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const user = await requireUser();
  if (user.role === "recruiter") redirect("/unauthorized");

  if (user.role === "admin" || user.role === "hr_manager") {
    const periods = await listPerformancePeriods();
    return <PerformancePeriodsView initialPeriods={periods} />;
  }

  const assignments = await getPerformanceTeamRows(user.employeeId);
  redirect(assignments.length > 0 ? "/performance/tim" : "/performance/saya");
}
