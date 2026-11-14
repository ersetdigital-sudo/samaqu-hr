import { redirect } from "next/navigation";
import { PerformanceTeamView } from "@/components/performance/performance-team-view";
import { requireUser } from "@/lib/auth/session";
import { getPerformanceTeamRows } from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export default async function PerformanceTeamPage() {
  const user = await requireUser();
  if (user.role === "recruiter") redirect("/unauthorized");
  const rows = await getPerformanceTeamRows(user.employeeId);
  return <PerformanceTeamView initialRows={rows} linked={Boolean(user.employeeId)} />;
}
