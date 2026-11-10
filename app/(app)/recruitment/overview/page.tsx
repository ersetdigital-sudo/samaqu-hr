import { OverviewView } from "@/components/views/overview-view";
import { requireRole } from "@/lib/auth/session";
import { getRecruitmentOverviewBoard } from "@/lib/recruitment/live/candidates";
import { getUpcomingInterviews } from "@/lib/recruitment/live/interviews";
import {
  buildRecruitmentOverview,
  toOverviewInterviews,
} from "@/lib/recruitment/live/overview";

export const dynamic = "force-dynamic";

export default async function RecruitmentOverviewPage() {
  const user = await requireRole(["hr_manager", "recruiter"]);
  try {
    const [board, interviews] = await Promise.all([
      getRecruitmentOverviewBoard(),
      getUpcomingInterviews(5).catch(() => []),
    ]);
    return (
      <OverviewView
        userName={user.name}
        initial={buildRecruitmentOverview(board)}
        interviews={toOverviewInterviews(interviews)}
      />
    );
  } catch {
    return (
      <OverviewView
        userName={user.name}
        initial={null}
        initialError="Data rekrutmen belum dapat dimuat. Silakan coba lagi."
        interviews={[]}
      />
    );
  }
}
