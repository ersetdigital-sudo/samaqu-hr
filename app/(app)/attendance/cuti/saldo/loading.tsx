import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function LeaveBalanceLoading() {
  return <PageSkeleton rows={8} cards={4} />;
}
