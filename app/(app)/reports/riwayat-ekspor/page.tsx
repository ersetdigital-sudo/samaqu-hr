import { ReportsExportHistoryView } from "@/components/reports/reports-export-history-view";
import { requireRole } from "@/lib/auth/session";
import { listReportExports } from "@/lib/reports/repository";

export const dynamic = "force-dynamic";

export default async function ReportsExportHistoryPage() {
  await requireRole(["hr_manager"]);
  const logs = await listReportExports({ from: "", to: "" });
  return <ReportsExportHistoryView initialLogs={logs} />;
}
