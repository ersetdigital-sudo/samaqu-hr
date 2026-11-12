/** Lapisan akses data Struktur Organisasi (server-side, read-only). */

import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import type { EmployeeStatus } from "@/lib/employees/types";
import type { OrganizationEmployee } from "@/lib/organization/types";

export class OrganizationDataError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrganizationDataError";
    this.status = status;
  }
}

type ChartRow = {
  id: string;
  full_name: string;
  position: string;
  department: string;
  status: EmployeeStatus;
  manager_id: string | null;
};

/** Hanya kolom bagan; data sensitif tidak pernah keluar dari fungsi database. */
export async function getOrganizationChart(): Promise<
  OrganizationEmployee[]
> {
  const { data, error } = await (await getServerSupabase()).rpc(
    "organization_chart"
  );

  if (error) {
    if (error.code === "42501") {
      throw new OrganizationDataError("Akses ditolak", 403);
    }
    throw new OrganizationDataError("Gagal memuat struktur organisasi", 500);
  }

  return ((data ?? []) as ChartRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    position: row.position,
    department: row.department,
    status: row.status,
    managerId: row.manager_id,
  }));
}
