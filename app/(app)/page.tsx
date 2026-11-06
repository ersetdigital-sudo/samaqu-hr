import { DashboardView } from "@/components/views/dashboard-view";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser("/");
  return <DashboardView user={user} />;
}
