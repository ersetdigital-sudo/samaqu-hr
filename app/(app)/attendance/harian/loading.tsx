import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function DailyAttendanceLoading() {
  return <PageSkeleton rows={8} cards={5} />;
}
