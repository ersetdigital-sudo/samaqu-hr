import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AccessGuard } from "@/components/access-guard";
import { Sidebar } from "@/components/app-sidebar/sidebar";
import { CandidateDrawer } from "@/components/candidate-drawer";
import { CloseJobModal } from "@/components/close-job-modal";
import { JobModal } from "@/components/job-modal";
import { MobileTabs } from "@/components/mobile-tabs";
import { RecruitmentProvider } from "@/components/recruitment-provider";
import { Toast } from "@/components/toast";
import { Topbar } from "@/components/topbar";
import { requireUser } from "@/lib/auth/session";
import { getRecruitmentSnapshot } from "@/lib/recruitment/repository";
import { hasOpenPerformanceAssignment } from "@/lib/performance/repository";
import { canAccess, findModule } from "@/lib/navigation";
import {
  SIDEBAR_COOKIE,
  sidebarCollapsedFromCookie,
} from "@/lib/sidebar-cookie";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Pertahanan berlapis: proxy sudah menolak, layout memverifikasi ulang.
  const user = await requireUser();
  const sidebarCollapsed = sidebarCollapsedFromCookie(
    (await cookies()).get(SIDEBAR_COOKIE)?.value
  );
  const recruitment = findModule("recruitment");
  const initial = recruitment && canAccess(user.role, recruitment)
    ? await getRecruitmentSnapshot()
    : { jobs: [], candidates: [], interviews: [], activities: [] };
  const performanceReviewer =
    user.role === "employee"
      ? await hasOpenPerformanceAssignment(user.employeeId)
      : true;

  return (
    <RecruitmentProvider initial={initial}>
      <div className="flex min-h-screen">
        <Sidebar
          user={user}
          initialCollapsed={sidebarCollapsed}
          performanceReviewer={performanceReviewer}
        />
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar user={user} />
          <MobileTabs user={user} performanceReviewer={performanceReviewer} />
          <main
            id="view"
            className="min-w-0 p-5 lg:p-8 max-w-[1320px] w-full"
          >
            <AccessGuard role={user.role}>{children}</AccessGuard>
          </main>
        </div>
      </div>
      <JobModal />
      <CloseJobModal />
      <CandidateDrawer />
      <Toast />
    </RecruitmentProvider>
  );
}
