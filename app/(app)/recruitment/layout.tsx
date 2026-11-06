import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/session";

export default async function RecruitmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["hr_manager", "recruiter"]);
  return children;
}
