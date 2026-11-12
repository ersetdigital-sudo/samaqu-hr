import { MyPositionHistoryView } from "@/components/position-history/my-position-history-view";
import { requireRole } from "@/lib/auth/session";
import { listMyPositionHistory } from "@/lib/position-history/repository";

export const dynamic = "force-dynamic";

export default async function MyPositionHistoryPage() {
  await requireRole(["employee"]);
  const result = await listMyPositionHistory();

  return (
    <MyPositionHistoryView
      linked={Boolean(result.employeeId)}
      employeeName={result.employeeName}
      history={result.history}
    />
  );
}
