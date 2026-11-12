import { DailyAttendanceView } from "@/components/attendance/daily-attendance-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { getDailyAttendance } from "@/lib/attendance/repository";

export const dynamic = "force-dynamic";

export default async function DailyAttendancePage() {
  await requireRole(["hr_manager"]);
  const date = isoDateJakarta();
  const data = await getDailyAttendance(date);

  return <DailyAttendanceView initialData={data} initialDate={date} />;
}
