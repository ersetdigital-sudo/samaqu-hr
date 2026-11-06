import { ContractsView } from "@/components/contracts/contracts-view";
import {
  listContractEmployeeOptions,
  listContractSummaries,
} from "@/lib/contracts/repository";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const [contracts, employees] = await Promise.all([
    listContractSummaries(),
    listContractEmployeeOptions(),
  ]);

  return (
    <ContractsView initialContracts={contracts} initialEmployees={employees} />
  );
}
