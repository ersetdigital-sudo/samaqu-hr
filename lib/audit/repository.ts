/** Akses data audit log. */

import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import type { AuditEvent, AuditFilters, AuditResult } from "@/lib/audit/types";
import { AUDIT_PAGE_SIZE } from "@/lib/audit/rules";

export type AuditTechnicalError = {
  code?: string;
  functionName?: string;
  message?: string;
};

export class AuditDataError extends Error {
  readonly status: number;
  readonly technical?: AuditTechnicalError;
  constructor(message: string, status = 400, technical?: AuditTechnicalError) {
    super(message);
    this.name = "AuditDataError";
    this.status = status;
    this.technical = technical;
  }
}

const mapRpcError = (
  error: { code?: string; message?: string },
  functionName: string
) => {
  const message = error.message?.trim() || "Gagal memuat audit log";
  if (error.code === "42501") return new AuditDataError(message, 403);
  if (error.code === "P0002") return new AuditDataError(message, 404);
  if (error.code === "P0001") return new AuditDataError(message, 400);
  return new AuditDataError(
    "Gagal memuat audit log",
    500,
    { code: error.code, functionName, message }
  );
};

const nullable = (value: string): string | null =>
  value.trim() === "" ? null : value.trim();

export async function getAuditLog(
  filters: AuditFilters,
  page: number
): Promise<AuditResult> {
  const currentPage = Math.max(1, Math.trunc(page) || 1);
  const { data, error } = await (await getServerSupabase()).rpc(
    "audit_log_events",
    {
      p_module: nullable(filters.module),
      p_from: nullable(filters.from),
      p_to: nullable(filters.to),
      p_actor: nullable(filters.actor),
      p_search: nullable(filters.q),
      p_limit: AUDIT_PAGE_SIZE,
      p_offset: (currentPage - 1) * AUDIT_PAGE_SIZE,
    }
  );
  if (error) throw mapRpcError(error, "audit_log_events");
  const payload = data as {
    total?: number;
    items?: {
      occurred_at: string;
      module_key: string;
      module_label: string;
      action_label: string;
      object_label: string;
      actor_name: string;
    }[];
  } | null;

  const items: AuditEvent[] = (payload?.items ?? []).map((row) => ({
    occurredAt: row.occurred_at,
    moduleKey: row.module_key,
    moduleLabel: row.module_label,
    actionLabel: row.action_label,
    objectLabel: row.object_label,
    actorName: row.actor_name,
  }));

  return { total: Math.max(0, payload?.total ?? 0), items };
}
