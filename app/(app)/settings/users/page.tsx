import { UsersView } from "@/components/settings/users-view";
import { requireRole } from "@/lib/auth/session";
import {
  listEmployeeOptions,
  listRoleOptions,
  listUsers,
} from "@/lib/users/repository";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await requireRole(["admin"], "/settings/users");

  const [users, roles, employees] = await Promise.all([
    listUsers(),
    listRoleOptions(),
    listEmployeeOptions(),
  ]);

  return (
    <UsersView
      initialUsers={users}
      roles={roles}
      employees={employees}
      currentUserId={user.id}
    />
  );
}
