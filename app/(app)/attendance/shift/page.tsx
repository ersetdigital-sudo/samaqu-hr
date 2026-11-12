import { ScheduleView } from "@/components/attendance/schedule-view";
import { requireRole } from "@/lib/auth/session";
import { getScheduleBoard } from "@/lib/attendance/repository";

export const dynamic = "force-dynamic";

export default async function AttendanceSchedulePage() {
  await requireRole(["hr_manager"]);
  const board = await getScheduleBoard();

  return (
    <ScheduleView
      initialSchedule={board.schedule}
      initialHolidays={board.holidays}
    />
  );
}
