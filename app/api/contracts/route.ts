import { NextResponse } from "next/server";
import {
  createContract,
  listContractEmployeeOptions,
  listContractSummaries,
} from "@/lib/contracts/repository";
import type { ContractInput } from "@/lib/contracts/types";
import { contractErrorResponse, contractsGuard } from "@/lib/contracts/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await contractsGuard();
  if (guard.response) return guard.response;

  try {
    const [contracts, employees] = await Promise.all([
      listContractSummaries(),
      listContractEmployeeOptions(),
    ]);

    return NextResponse.json(
      { contracts, employees },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return contractErrorResponse(error, "gagal memuat daftar");
  }
}

export async function POST(request: Request) {
  const guard = await contractsGuard();
  if (guard.response) return guard.response;

  try {
    const body = (await request.json()) as ContractInput;
    const contract = await createContract(body);
    return NextResponse.json({ contract }, { status: 201 });
  } catch (error) {
    return contractErrorResponse(error, "gagal menambah kontrak");
  }
}
