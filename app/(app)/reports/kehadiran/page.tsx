import { ReportsAttendanceView } from "@/components/reports/reports-attendance-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { getAttendanceReport } from "@/lib/reports/repository";

export const dynamic = "force-dynamic";

export default async function ReportsAttendancePage() {
  await requireRole(["hr_manager"]);
  const month = isoDateJakarta().slice(0, 7);
  const data = await getAttendanceReport(month, "Semua");
  return <ReportsAttendanceView initialData={data} />;
}
