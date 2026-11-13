import { RecapView } from "@/components/recap/recap-view";
import { requireRole } from "@/lib/auth/session";
import { isoDateJakarta } from "@/lib/datetime";
import { getRecapData } from "@/lib/recap/repository";

export const dynamic = "force-dynamic";

export default async function RecapPage() {
  await requireRole(["hr_manager"]);
  const data = await getRecapData(isoDateJakarta().slice(0, 7));

  return <RecapView initialData={data} />;
}
