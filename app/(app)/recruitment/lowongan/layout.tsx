import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/session";
import "@/components/recruitment-live/live.css";

export const dynamic = "force-dynamic";

export default async function LowonganLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["hr_manager", "recruiter"]);
  return children;
}
