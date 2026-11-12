import { AbsensiView } from "@/components/attendance/absensi-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { getMyAttendanceMonth } from "@/lib/attendance/repository";

export const dynamic = "force-dynamic";

export default async function AbsensiPage() {
  await requireRole(["employee"]);
  const month = isoDateJakarta().slice(0, 7);
  const data = await getMyAttendanceMonth(month);

  return <AbsensiView initialData={data} initialMonth={month} />;
}
