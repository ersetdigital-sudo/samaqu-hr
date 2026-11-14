import { notFound, redirect } from "next/navigation";
import { PerformanceReviewForm } from "@/components/performance/performance-review-form";
import { requireUser } from "@/lib/auth/session";
import { getPerformanceReviewDetail } from "@/lib/performance/repository";

export const dynamic = "force-dynamic";

export default async function PerformanceReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (user.role === "recruiter") redirect("/unauthorized");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getPerformanceReviewDetail(id);
  if (!detail) notFound();

  const staff = user.role === "admin" || user.role === "hr_manager";
  const substitute = staff && user.employeeId !== detail.reviewerEmployeeId;

  return <PerformanceReviewForm initialDetail={detail} substitute={substitute} />;
}
