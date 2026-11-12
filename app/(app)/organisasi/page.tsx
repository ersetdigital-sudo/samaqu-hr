import { OrganizationView } from "@/components/organization/organization-view";
import { requireRole } from "@/lib/auth/session";
import { getOrganizationChart } from "@/lib/organization/repository";

export const dynamic = "force-dynamic";

export default async function MyOrganizationPage() {
  const user = await requireRole(["employee"]);
  const employees = await getOrganizationChart();

  return (
    <OrganizationView
      initialEmployees={employees}
      viewerEmployeeId={user.employeeId}
      canOpenDirectory={false}
      showWarnings={false}
    />
  );
}
