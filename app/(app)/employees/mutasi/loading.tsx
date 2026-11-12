import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function EmployeePositionHistoryLoading() {
  return <PageSkeleton rows={8} cards={3} />;
}
