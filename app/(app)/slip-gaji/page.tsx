import { MyPayslipsView } from "@/components/payroll/my-payslips-view";
import { requireRole } from "@/lib/auth/session";
import { listMyPayslips } from "@/lib/payroll/repository";

export const dynamic = "force-dynamic";

export default async function MyPayslipsPage() {
  await requireRole(["employee"]);
  const payslips = await listMyPayslips();
  return <MyPayslipsView payslips={payslips} />;
}
