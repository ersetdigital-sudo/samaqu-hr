import { PipelineView } from "@/components/views/pipeline-view";
import { requireRole } from "@/lib/auth/session";
import { getRecruitmentBoard } from "@/lib/recruitment/live/candidates";

export const dynamic = "force-dynamic";

export default async function RecruitmentPipelinePage() {
  await requireRole(["hr_manager", "recruiter"]);
  try {
    return <PipelineView initial={await getRecruitmentBoard()} />;
  } catch {
    return (
      <PipelineView
        initial={null}
        initialError="Pipeline kandidat belum dapat dimuat. Silakan coba lagi."
      />
    );
  }
}
