import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function AuditLogLoading() {
  return <PageSkeleton rows={8} cards={1} />;
}
