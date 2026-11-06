import { NextResponse } from "next/server";
import { endContract, updateContract } from "@/lib/contracts/repository";
import type { ContractInput } from "@/lib/contracts/types";
import { contractErrorResponse, contractsGuard } from "@/lib/contracts/http";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await contractsGuard();
  if (guard.response) return guard.response;

  try {
    const { id } = await params;
    const body = (await request.json()) as
      | ContractInput
      | { action: "end"; endDate?: string | null };

    if ("action" in body && body.action === "end") {
      const contract = await endContract(id, body.endDate ?? null);
      return NextResponse.json({ contract });
    }

    const contract = await updateContract(id, body as ContractInput);
    return NextResponse.json({ contract });
  } catch (error) {
    return contractErrorResponse(error, "gagal memperbarui kontrak");
  }
}
