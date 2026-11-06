import type { Contract } from "@/lib/contracts/types";

/** Mode form kontrak: tambah baru, perpanjang, atau edit kontrak aktif. */
export type ContractModalState = {
  mode: "create" | "renew" | "edit";
  contract: Contract | null;
  employeeId: string | null;
};
