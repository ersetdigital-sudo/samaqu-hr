import { notFound } from "next/navigation";
import { PayslipView } from "@/components/payroll/payslip-view";
import { requireRole } from "@/lib/auth/session";
import { getMyPayslip } from "@/lib/payroll/repository";

export const dynamic = "force-dynamic";

export default async function MyPayslipPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  await requireRole(["employee"]);
  const { runId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(runId)) notFound();
  const payslip = await getMyPayslip(runId);
  if (!payslip) notFound();
  return (
    <PayslipView
      payslip={payslip}
      backHref="/slip-gaji"
      backLabel="Kembali ke Slip Gaji"
    />
  );
}
