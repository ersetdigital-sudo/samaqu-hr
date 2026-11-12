import { DocumentsView } from "@/components/documents/documents-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { listEmployeeDocuments } from "@/lib/documents/repository";

export const dynamic = "force-dynamic";

export default async function EmployeeDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  await requireRole(["hr_manager"]);

  const params = await searchParams;
  const employeeId =
    typeof params.employee === "string" ? params.employee : null;
  const documents = await listEmployeeDocuments();

  return (
    <DocumentsView
      initialDocuments={documents}
      todayIso={isoDateJakarta()}
      initialEmployeeId={employeeId}
    />
  );
}
