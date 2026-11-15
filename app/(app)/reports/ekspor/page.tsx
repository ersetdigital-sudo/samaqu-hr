import { ReportsEmployeeExportView } from "@/components/reports/reports-employee-export-view";
import { requireRole } from "@/lib/auth/session";
import { getEmployeeExportData } from "@/lib/reports/repository";

export const dynamic = "force-dynamic";

export default async function ReportsEmployeeExportPage() {
  await requireRole(["hr_manager"]);
  const data = await getEmployeeExportData("Semua", "Semua");
  return <ReportsEmployeeExportView initialData={data} />;
}
