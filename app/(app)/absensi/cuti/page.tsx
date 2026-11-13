import { LeaveEmployeeView } from "@/components/leave/leave-employee-view";
import { requireRole } from "@/lib/auth/session";
import { getMyLeaveData } from "@/lib/leave/repository";

export const dynamic = "force-dynamic";

export default async function MyLeavePage() {
  await requireRole(["employee"]);
  const data = await getMyLeaveData();

  return <LeaveEmployeeView initialData={data} />;
}
