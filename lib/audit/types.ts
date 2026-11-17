export type AuditModuleKey =
  | "contracts"
  | "employees"
  | "users"
  | "recruitment"
  | "documents"
  | "performance"
  | "payroll"
  | "reports"
  | "leave"
  | "overtime"
  | "attendance";

export type AuditModuleOption = {
  key: AuditModuleKey;
  label: string;
  adminOnly?: boolean;
};

export const AUDIT_MODULES: AuditModuleOption[] = [
  { key: "contracts", label: "Kontrak" },
  { key: "employees", label: "Karyawan" },
  { key: "users", label: "Pengguna & Peran", adminOnly: true },
  { key: "recruitment", label: "Rekrutmen" },
  { key: "documents", label: "Dokumen" },
  { key: "performance", label: "Performance" },
  { key: "payroll", label: "Payroll" },
  { key: "reports", label: "Laporan" },
  { key: "leave", label: "Cuti & Izin" },
  { key: "overtime", label: "Lembur" },
  { key: "attendance", label: "Kehadiran" },
];

export type AuditEvent = {
  occurredAt: string;
  moduleKey: string;
  moduleLabel: string;
  actionLabel: string;
  objectLabel: string;
  actorName: string;
};

export type AuditResult = {
  total: number;
  items: AuditEvent[];
};

export type AuditFilters = {
  module: string;
  from: string;
  to: string;
  actor: string;
  q: string;
};
