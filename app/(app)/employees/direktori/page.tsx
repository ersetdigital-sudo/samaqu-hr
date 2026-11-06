import { DirectoryView } from "@/components/employees/directory-view";
import {
  getNextEmployeeId,
  listEmployeeSummaries,
} from "@/lib/employees/repository";

export const dynamic = "force-dynamic";

export default async function EmployeeDirectoryPage() {
  const [employees, nextId] = await Promise.all([
    listEmployeeSummaries(),
    getNextEmployeeId(),
  ]);

  return <DirectoryView initialEmployees={employees} initialNextId={nextId} />;
}
