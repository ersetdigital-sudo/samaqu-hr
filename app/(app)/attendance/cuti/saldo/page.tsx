import { LeaveBalanceView } from "@/components/leave/leave-balance-view";
import { requireRole } from "@/lib/auth/session";
import { getLeaveBalances } from "@/lib/leave/repository";

export const dynamic = "force-dynamic";

export default async function LeaveBalancePage() {
  await requireRole(["hr_manager"]);
  const data = await getLeaveBalances();

  return <LeaveBalanceView initialData={data} />;
}
