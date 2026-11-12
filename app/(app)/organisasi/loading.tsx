import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function MyOrganizationLoading() {
  return <PageSkeleton rows={8} cards={3} />;
}
