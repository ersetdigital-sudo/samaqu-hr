import { AccessMatrixView } from "@/components/settings/access-matrix-view";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AccessMatrixPage() {
  await requireRole(["hr_manager"]);
  return <AccessMatrixView />;
}
