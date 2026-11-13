import { DailyAttendanceView } from "@/components/attendance/daily-attendance-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { getDailyAttendance } from "@/lib/attendance/repository";
import { isValidIsoDate } from "@/lib/attendance/rules";

export const dynamic = "force-dynamic";

export default async function DailyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireRole(["hr_manager"]);
  const today = isoDateJakarta();
  const requested = (await searchParams).date;
  const date =
    requested && isValidIsoDate(requested) && requested <= today
      ? requested
      : today;
  const data = await getDailyAttendance(date);

  return <DailyAttendanceView initialData={data} initialDate={date} />;
}
