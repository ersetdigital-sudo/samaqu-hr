import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { JobForm } from "@/components/recruitment-live/job-form";
import { requireRole } from "@/lib/auth/session";
import { getDepartments, getJob } from "@/lib/recruitment/live/repository";
import { slugify } from "@/lib/recruitment/live/validation";

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ duplicate?: string | string[] }> }) {
  await requireRole(["hr_manager", "recruiter"]);
  const params = await searchParams;
  const duplicateId = typeof params.duplicate === "string" ? params.duplicate : undefined;
  const [departments, source] = await Promise.all([getDepartments(), duplicateId ? getJob(duplicateId) : Promise.resolve(null)]);
  if (duplicateId && !source) notFound();
  const initial = source ? { ...source, slug: `${slugify(source.title).slice(0, 80).replace(/-$/, "") || "lowongan"}-${randomUUID().slice(0, 6)}`, status: "Draf" as const, published_at: null, closed_at: null } : undefined;
  return <JobForm initial={initial} departments={departments} duplicate={!!source} />;
}
