/** Status integrasi baca-saja (khusus Admin). */

import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { ACADEMY_URL } from "@/lib/external-links";

export type IntegrationEnvStatus = {
  key: string;
  label: string;
  configured: boolean;
};

export type IntegrationStatus = {
  senderEmail: string;
  cvSchedule: string;
  lastCvDeletedAt: string | null;
  env: IntegrationEnvStatus[];
  academyUrl: string;
};

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const { data, error } = await (await getServerSupabase()).rpc(
    "admin_integration_status"
  );
  if (error) {
    throw new Error(
      error.code === "42501"
        ? "Akses ditolak: status integrasi hanya untuk Admin"
        : "Gagal memuat status integrasi"
    );
  }
  const payload = data as { last_cv_deleted_at?: string | null } | null;

  const checks: [string, string][] = [
    ["NEXT_PUBLIC_SUPABASE_URL", "Supabase URL"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anon key"],
    ["SUPABASE_SERVICE_ROLE_KEY", "Supabase service role key"],
    ["CRON_SECRET", "CRON secret"],
    ["NEXT_PUBLIC_CAREERS_URL", "URL halaman karier"],
  ];

  return {
    senderEmail: "noreply@samaqu.id (SAMAQU HRIS)",
    cvSchedule: "02.00 WIB",
    lastCvDeletedAt: payload?.last_cv_deleted_at ?? null,
    env: checks.map(([key, label]) => ({
      key,
      label,
      configured: Boolean(process.env[key]?.trim()),
    })),
    academyUrl: ACADEMY_URL,
  };
}
