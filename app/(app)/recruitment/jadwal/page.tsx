import { JadwalView } from "@/components/views/jadwal-view";
import { requireRole } from "@/lib/auth/session";
import { canManageEmployees } from "@/lib/navigation";
import { listInterviewSchedules } from "@/lib/recruitment/live/interviews";

export const dynamic = "force-dynamic";

export default async function RecruitmentJadwalPage() {
  const user = await requireRole(["hr_manager", "recruiter"]);
  const canConvert = canManageEmployees(user.role);
  try {
    return (
      <JadwalView
        initial={await listInterviewSchedules()}
        canConvert={canConvert}
      />
    );
  } catch {
    return (
      <JadwalView
        initial={null}
        initialError="Jadwal wawancara belum dapat dimuat. Silakan coba lagi."
        canConvert={canConvert}
      />
    );
  }
}
