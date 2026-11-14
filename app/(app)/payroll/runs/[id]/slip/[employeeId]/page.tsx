import { notFound } from "next/navigation";
import { PayslipView } from "@/components/payroll/payslip-view";
import { requireRole } from "@/lib/auth/session";
import { getPayrollRunDetail } from "@/lib/payroll/repository";

export const dynamic = "force-dynamic";

export default async function PayrollSlipPage({
  params,
}: {
  params: Promise<{ id: string; employeeId: string }>;
}) {
  await requireRole(["hr_manager"]);
  const { id, employeeId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getPayrollRunDetail(id);
  if (!detail || (detail.run.status !== "Final" && detail.run.status !== "Dibayar")) {
    notFound();
  }
  const employee = detail.employees.find(
    (row) => row.employeeId === employeeId
  );
  if (!employee?.calculation) notFound();

  return (
    <PayslipView
      payslip={{
        runId: detail.run.id,
        periodMonth: detail.run.periodMonth,
        status: detail.run.status,
        paidDate: detail.run.paidDate,
        finalizedAt: detail.run.finalizedAt,
        employee: {
          id: employee.employeeId,
          name: employee.employeeName,
          department: employee.department,
          position: employee.position,
        },
        calculation: employee.calculation,
      }}
      backHref={`/payroll/runs/${detail.run.id}`}
      backLabel="Kembali ke Run"
    />
  );
}
