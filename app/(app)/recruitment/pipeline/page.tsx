import { PipelineView } from "@/components/views/pipeline-view";
import { requireRole } from "@/lib/auth/session";
import { canManageEmployees } from "@/lib/navigation";
import { getRecruitmentBoard } from "@/lib/recruitment/live/candidates";

export const dynamic = "force-dynamic";

export default async function RecruitmentPipelinePage() {
  const user = await requireRole(["hr_manager", "recruiter"]);
  const canConvert = canManageEmployees(user.role);
  try {
    return (
      <PipelineView
        initial={await getRecruitmentBoard()}
        canConvert={canConvert}
      />
    );
  } catch {
    return (
      <PipelineView
        initial={null}
        initialError="Pipeline kandidat belum dapat dimuat. Silakan coba lagi."
        canConvert={canConvert}
      />
    );
  }
}
