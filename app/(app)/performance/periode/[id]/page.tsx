import { notFound } from "next/navigation";
import { PerformancePeriodDetailView } from "@/components/performance/performance-period-detail-view";
import { requireRole } from "@/lib/auth/session";
import { getPerformancePeriodDetail } from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export default async function PerformancePeriodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["hr_manager"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getPerformancePeriodDetail(id);
  if (!detail) notFound();
  return <PerformancePeriodDetailView initialDetail={detail} />;
}
