import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { assertId, RecruitmentError } from "./http";
import type { StageHistoryEntry } from "./types";

const COLUMNS = "id,application_id,from_stage,to_stage,changed_by,changed_at";

type Row = {
  id: number;
  application_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  changed_at: string;
};

/** Riwayat tahap + nama pelaku (nama akun atau "Pengguna terhapus"). */
export async function listStageHistory(
  applicationId: string,
): Promise<StageHistoryEntry[]> {
  assertId(applicationId);
  const db = await getServerSupabase();
  const { data, error } = await db
    .from("job_application_stage_history")
    .select(COLUMNS)
    .eq("application_id", applicationId)
    .order("changed_at", { ascending: false })
    .order("id", { ascending: false });

  if (error)
    throw new RecruitmentError("Riwayat tahap belum dapat dimuat", 500);

  const rows = (data ?? []) as unknown as Row[];
  const actorIds = [
    ...new Set(
      rows
        .map((row) => row.changed_by)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const nameById = new Map<string, string>();

  if (actorIds.length > 0) {
    const { data: actors, error: actorError } = await db.rpc(
      "application_history_actors",
      { p_ids: actorIds },
    );
    if (actorError)
      throw new RecruitmentError("Riwayat tahap belum dapat dimuat", 500);
    for (const actor of (actors ?? []) as { id: string; full_name: string }[]) {
      nameById.set(actor.id, actor.full_name);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    changedAt: row.changed_at,
    changedByName: row.changed_by
      ? nameById.get(row.changed_by) ?? "Pengguna terhapus"
      : "Sistem",
  }));
}
