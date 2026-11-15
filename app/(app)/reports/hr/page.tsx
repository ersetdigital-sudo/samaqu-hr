import { ReportsHrView } from "@/components/reports/reports-hr-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { getHrReport } from "@/lib/reports/repository";

export const dynamic = "force-dynamic";

export default async function ReportsHrPage() {
  await requireRole(["hr_manager"]);
  const data = await getHrReport(isoDateJakarta());
  return <ReportsHrView initialData={data} />;
}
