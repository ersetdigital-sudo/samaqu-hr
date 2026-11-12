/** Label dan penjelasan data atasan yang tidak wajar (hanya HR/Admin). */

import type { OrganizationIssue } from "@/lib/organization/types";

export const ORGANIZATION_ISSUE_LABELS: Record<OrganizationIssue, string> = {
  "missing-manager": "Atasan hilang",
  cycle: "Siklus atasan",
};

export const ORGANIZATION_ISSUE_DESCRIPTIONS: Record<
  OrganizationIssue,
  string
> = {
  "missing-manager":
    "Atasan langsung yang tercatat tidak ada di data karyawan. Node ditampilkan sebagai akar agar bagan tetap lengkap.",
  cycle:
    "Rantai atasan berputar (siklus). Node ditampilkan sebagai akar agar bagan tidak error.",
};
