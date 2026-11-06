import "server-only";
import { getServiceSupabase } from "@/lib/supabase/server";
import { CV_RETENTION } from "./retention";

const BATCH_LIMIT = 100;

type DueCv = { application_id: string; cv_path: string };
export type CvRetentionResult = {
  due: number;
  deleted: number;
  failed: number;
};

export async function processDueCvRetention(): Promise<CvRetentionResult> {
  const db = getServiceSupabase();
  const due = await db.rpc("recruitment_cvs_due", {
    p_rejected_days: CV_RETENTION.rejectedDays,
    p_closed_days: CV_RETENTION.closedDays,
    p_limit: BATCH_LIMIT,
  });
  if (due.error) throw new Error("Gagal mengambil daftar CV yang jatuh tempo.");

  const rows = (due.data ?? []) as DueCv[];
  if (!rows.length) return { due: 0, deleted: 0, failed: 0 };

  const paths = rows.map((row) => row.cv_path);
  const removed = await db.storage.from("cvs").remove(paths);
  if (removed.error) {
    console.error("[cv-retention] storage delete failed");
    return { due: rows.length, deleted: 0, failed: rows.length };
  }

  const marked = await db
    .from("job_applications")
    .update({ cv_deleted_at: new Date().toISOString() })
    .in(
      "id",
      rows.map((row) => row.application_id),
    )
    .is("cv_deleted_at", null);
  if (marked.error) {
    console.error("[cv-retention] mark deleted failed");
    return { due: rows.length, deleted: 0, failed: rows.length };
  }

  return { due: rows.length, deleted: rows.length, failed: 0 };
}
