import { OrganizationView } from "@/components/organization/organization-view";
import { requireRole } from "@/lib/auth/session";
import { getOrganizationChart } from "@/lib/organization/repository";

export const dynamic = "force-dynamic";

export default async function EmployeeOrganizationPage() {
  const user = await requireRole(["hr_manager"]);
  const employees = await getOrganizationChart();

  return (
    <OrganizationView
      initialEmployees={employees}
      viewerEmployeeId={user.employeeId}
      canOpenDirectory
      showWarnings
    />
  );
}
