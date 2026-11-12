import { PositionHistoryView } from "@/components/position-history/position-history-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { getPositionHistoryBoard } from "@/lib/position-history/repository";

export const dynamic = "force-dynamic";

export default async function EmployeePositionHistoryPage() {
  await requireRole(["hr_manager"]);
  const board = await getPositionHistoryBoard();

  return (
    <PositionHistoryView
      initialHistory={board.history}
      initialEmployees={board.employees}
      todayIso={isoDateJakarta()}
    />
  );
}
