import { notFound } from "next/navigation";
import { PayrollRunView } from "@/components/payroll/payroll-run-view";
import { requireRole } from "@/lib/auth/session";
import { getPayrollRunDetail } from "@/lib/payroll/repository";

export const dynamic = "force-dynamic";

export default async function PayrollRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["hr_manager"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getPayrollRunDetail(id);
  if (!detail) notFound();
  return <PayrollRunView initialDetail={detail} />;
}
