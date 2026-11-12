import { MyDocumentsView } from "@/components/documents/my-documents-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { listMyDocuments } from "@/lib/documents/repository";

export const dynamic = "force-dynamic";

export default async function MyDocumentsPage() {
  await requireRole(["employee"]);

  const { employeeId, documents } = await listMyDocuments();

  return (
    <MyDocumentsView
      linked={Boolean(employeeId)}
      documents={documents}
      todayIso={isoDateJakarta()}
    />
  );
}
