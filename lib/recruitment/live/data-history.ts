import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { assertId, RecruitmentError } from "./http";
import type { ApplicationDataHistoryEntry } from "./types";

const COLUMNS =
  "id,application_id,column_name,old_value,new_value,changed_by,changed_at";

type Row = {
  id: number;
  application_id: string;
  column_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
};

/** Riwayat perubahan data + nama pelaku (atau Sistem/Pengguna terhapus). */
export async function listApplicationDataHistory(
  applicationId: string
): Promise<ApplicationDataHistoryEntry[]> {
  assertId(applicationId);
  const db = await getServerSupabase();
  const { data, error } = await db
    .from("job_application_data_history")
    .select(COLUMNS)
    .eq("application_id", applicationId)
    .order("changed_at", { ascending: false })
    .order("id", { ascending: false });

  if (error)
    throw new RecruitmentError(
      "Riwayat perubahan data belum dapat dimuat",
      500
    );

  const rows = (data ?? []) as unknown as Row[];
  const actorIds = [
    ...new Set(
      rows
        .map((row) => row.changed_by)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const nameById = new Map<string, string>();

  if (actorIds.length > 0) {
    const { data: actors, error: actorError } = await db.rpc(
      "application_history_actors",
      { p_ids: actorIds }
    );
    if (actorError)
      throw new RecruitmentError(
        "Riwayat perubahan data belum dapat dimuat",
        500
      );
    for (const actor of (actors ?? []) as { id: string; full_name: string }[]) {
      nameById.set(actor.id, actor.full_name);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    column: row.column_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedAt: row.changed_at,
    changedByName: row.changed_by
      ? nameById.get(row.changed_by) ?? "Pengguna terhapus"
      : "Sistem",
  }));
}
