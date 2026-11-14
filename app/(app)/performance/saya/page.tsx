import { redirect } from "next/navigation";
import { PerformanceMyResultsView } from "@/components/performance/performance-my-results-view";
import { requireUser } from "@/lib/auth/session";
import { getMyPerformanceResults } from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export default async function PerformanceMyPage() {
  const user = await requireUser();
  if (user.role === "recruiter") redirect("/unauthorized");
  const results = await getMyPerformanceResults(user.employeeId);
  return (
    <PerformanceMyResultsView
      results={results}
      linked={Boolean(user.employeeId)}
    />
  );
}
