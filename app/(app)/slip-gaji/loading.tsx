import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function MyPayslipsLoading() {
  return <PageSkeleton rows={4} cards={1} />;
}
