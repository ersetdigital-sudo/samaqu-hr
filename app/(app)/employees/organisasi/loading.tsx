import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function EmployeeOrganizationLoading() {
  return <PageSkeleton rows={8} cards={3} />;
}
