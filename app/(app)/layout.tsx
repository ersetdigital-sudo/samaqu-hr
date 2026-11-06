import type { ReactNode } from "react";
import { AccessGuard } from "@/components/access-guard";
import { CandidateDrawer } from "@/components/candidate-drawer";
import { CloseJobModal } from "@/components/close-job-modal";
import { JobModal } from "@/components/job-modal";
import { MobileTabs } from "@/components/mobile-tabs";
import { RecruitmentProvider } from "@/components/recruitment-provider";
import { Sidebar } from "@/components/sidebar";
import { Toast } from "@/components/toast";
import { Topbar } from "@/components/topbar";
import { requireUser } from "@/lib/auth/session";
import { getRecruitmentSnapshot } from "@/lib/recruitment/repository";
import { canAccess, findModule } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Pertahanan berlapis: proxy sudah menolak, layout memverifikasi ulang.
  const user = await requireUser();
  const recruitment = findModule("recruitment");
  const initial = recruitment && canAccess(user.role, recruitment)
    ? await getRecruitmentSnapshot()
    : { jobs: [], candidates: [], interviews: [], activities: [] };

  return (
    <RecruitmentProvider initial={initial}>
      <div className="flex min-h-screen">
        <Sidebar user={user} />
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar user={user} />
          <MobileTabs user={user} />
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
