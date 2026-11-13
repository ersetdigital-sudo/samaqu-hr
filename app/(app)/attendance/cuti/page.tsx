import { LeaveApprovalView } from "@/components/leave/leave-approval-view";
import { requireRole } from "@/lib/auth/session";
import { getLeaveApprovalData } from "@/lib/leave/repository";

export const dynamic = "force-dynamic";

export default async function LeaveApprovalPage() {
  await requireRole(["hr_manager"]);
  const data = await getLeaveApprovalData();

  return <LeaveApprovalView initialData={data} />;
}
