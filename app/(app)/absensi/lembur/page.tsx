import { OvertimeEmployeeView } from "@/components/overtime/overtime-employee-view";
import { requireRole } from "@/lib/auth/session";
import { getMyOvertimeData } from "@/lib/overtime/repository";

export const dynamic = "force-dynamic";

export default async function MyOvertimePage() {
  await requireRole(["employee"]);
  const data = await getMyOvertimeData();

  return <OvertimeEmployeeView initialData={data} />;
}
