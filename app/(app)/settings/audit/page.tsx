import { AuditLogView } from "@/components/settings/audit-log-view";
import { requireRole } from "@/lib/auth/session";
import { getAuditLog } from "@/lib/audit/repository";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const user = await requireRole(["hr_manager"]);
  const initialData = await getAuditLog(
    { module: "", from: "", to: "", actor: "", q: "" },
    1
  );
  return (
    <AuditLogView
      initialData={initialData}
      isAdmin={user.role === "admin"}
    />
  );
}
