import { OnboardingView } from "@/components/onboarding/onboarding-view";
import { requireRole } from "@/lib/auth/session";
import { getOnboardingBoard } from "@/lib/onboarding/repository";

export const dynamic = "force-dynamic";

export default async function RecruitmentOnboardingPage() {
  await requireRole(["hr_manager"]);
  try {
    return <OnboardingView initial={await getOnboardingBoard()} />;
  } catch {
    return (
      <OnboardingView
        initial={null}
        initialError="Data onboarding belum dapat dimuat. Silakan coba lagi."
      />
    );
  }
}
