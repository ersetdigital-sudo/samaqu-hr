import { OverviewView } from "@/components/views/overview-view";
import { requireRole } from "@/lib/auth/session";
import { getRecruitmentBoard } from "@/lib/recruitment/live/candidates";
import { buildRecruitmentOverview } from "@/lib/recruitment/live/overview";

export const dynamic = "force-dynamic";

export default async function RecruitmentOverviewPage() {
  const user = await requireRole(["hr_manager", "recruiter"]);
  try {
    const board = await getRecruitmentBoard();
    return (
      <OverviewView
        userName={user.name}
        initial={buildRecruitmentOverview(board)}
      />
    );
  } catch {
    return (
      <OverviewView
        userName={user.name}
        initial={null}
        initialError="Data rekrutmen belum dapat dimuat. Silakan coba lagi."
      />
    );
  }
}
