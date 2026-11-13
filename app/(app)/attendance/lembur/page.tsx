import { OvertimeApprovalView } from "@/components/overtime/overtime-approval-view";
import { requireRole } from "@/lib/auth/session";
import { getOvertimeApprovalData } from "@/lib/overtime/repository";

export const dynamic = "force-dynamic";

export default async function OvertimeApprovalPage() {
  await requireRole(["hr_manager"]);
  const data = await getOvertimeApprovalData();

  return <OvertimeApprovalView initialData={data} />;
}
