import { KandidatView } from "@/components/views/kandidat-view";
import { requireRole } from "@/lib/auth/session";
import { getRecruitmentBoard } from "@/lib/recruitment/live/candidates";

export const dynamic = "force-dynamic";

export default async function RecruitmentKandidatPage() {
  await requireRole(["hr_manager", "recruiter"]);
  try {
    return <KandidatView initial={await getRecruitmentBoard()} />;
  } catch {
    return (
      <KandidatView
        initial={null}
        initialError="Daftar kandidat belum dapat dimuat. Silakan coba lagi."
      />
    );
  }
}
