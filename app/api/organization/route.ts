import { NextResponse } from "next/server";
import {
  organizationFailure,
  organizationGuard,
} from "@/lib/organization/http";
import { getOrganizationChart } from "@/lib/organization/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await organizationGuard();
  if (guard.response) return guard.response;

  try {
    const employees = await getOrganizationChart();
    return NextResponse.json(
      { employees },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return organizationFailure(error);
  }
}
