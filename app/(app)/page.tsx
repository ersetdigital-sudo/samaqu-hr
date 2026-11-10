import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import { StaffDashboard } from "@/components/dashboard/staff-dashboard";
import { requireUser } from "@/lib/auth/session";
import { canManageEmployees } from "@/lib/navigation";
import {
  getEmployeeDashboardStats,
  getOwnEmployeeProfile,
  getRecruitmentDashboardData,
} from "@/lib/dashboard/repository";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser("/");

  if (user.role === "employee") {
    const employee = user.employeeId
      ? await getOwnEmployeeProfile(user.employeeId)
      : null;
    return <EmployeeDashboard user={user} employee={employee} />;
  }

  const showEmployees = canManageEmployees(user.role);

  try {
    const [recruitment, employees] = await Promise.all([
      getRecruitmentDashboardData(),
      showEmployees ? getEmployeeDashboardStats() : Promise.resolve(null),
    ]);

    return (
      <StaffDashboard
        user={user}
        recruitment={recruitment}
        employees={employees}
        showEmployees={showEmployees}
      />
    );
  } catch {
    return (
      <StaffDashboard
        user={user}
        recruitment={null}
        employees={null}
        showEmployees={showEmployees}
        error="Data dashboard belum dapat dimuat. Silakan muat ulang halaman ini."
      />
    );
  }
}
