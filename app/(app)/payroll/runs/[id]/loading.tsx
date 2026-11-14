import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function PayrollRunLoading() {
  return <PageSkeleton rows={10} cards={5} />;
}
