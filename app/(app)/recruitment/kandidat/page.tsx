import { KandidatView } from "@/components/views/kandidat-view";
import { requireRole } from "@/lib/auth/session";
import { canManageEmployees } from "@/lib/navigation";
import { getRecruitmentBoard } from "@/lib/recruitment/live/candidates";

export const dynamic = "force-dynamic";

export default async function RecruitmentKandidatPage() {
  const user = await requireRole(["hr_manager", "recruiter"]);
  const canConvert = canManageEmployees(user.role);
  try {
    return (
      <KandidatView
        initial={await getRecruitmentBoard()}
        canConvert={canConvert}
      />
    );
  } catch {
    return (
      <KandidatView
        initial={null}
        initialError="Daftar kandidat belum dapat dimuat. Silakan coba lagi."
        canConvert={canConvert}
      />
    );
  }
}
