import { IntegrationView } from "@/components/settings/integration-view";
import { requireRole } from "@/lib/auth/session";
import { getIntegrationStatus } from "@/lib/settings/integrations";

export const dynamic = "force-dynamic";

export default async function IntegrationPage() {
  await requireRole(["admin"]);
  const status = await getIntegrationStatus();
  return <IntegrationView status={status} />;
}
