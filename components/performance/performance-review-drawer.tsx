"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoGrid, InfoItem } from "@/components/ui/detail-info";
import { FormSection } from "@/components/ui/form-section";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { PerformanceReasonDialog } from "@/components/performance/performance-reason-dialog";
import { PerformanceReviewerDialog } from "@/components/performance/performance-reviewer-dialog";
import {
  PerformanceCategoryTag,
  PerformanceStatusTag,
} from "@/components/performance/performance-tags";
import { formatDateID, formatDateTimeID } from "@/lib/datetime";
import {
  formatPerformanceScore,
  formatReviewPeriod,
  reviewerLabel,
  scoreLabel,
} from "@/lib/performance/rules";
import type { PerformanceReviewDetail } from "@/lib/performance/types";

type Dialog = "return" | "exclude" | "approve" | "reviewer" | null;

export function PerformanceReviewDrawer({
  reviewId,
  open,
  onClose,
  onMutated,
}: {
  reviewId: string | null;
  open: boolean;
  onClose: () => void;
  onMutated: (message: string) => void;
}) {
  const [detail, setDetail] = useState<PerformanceReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);

  const load = useCallback(async () => {
    if (!reviewId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/performance/reviews/${reviewId}`, {
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | (PerformanceReviewDetail & { error?: string })
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Gagal memuat lembar penilaian");
      }
      setDetail(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat lembar penilaian"
      );
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setDialog(null);
      return;
    }
    setDetail(null);
    void load();
  }, [open, load]);

  const runAction = async (
    path: "return" | "exclude" | "approve",
    payload: Record<string, unknown> | undefined,
    message: string
  ) => {
    if (!reviewId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/performance/reviews/${reviewId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal memproses penilaian");
      }
      setDialog(null);
      await load();
      onMutated(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses penilaian");
    } finally {
      setBusy(false);
    }
  };

  const canEdit = detail
    ? detail.status === "Draft" || detail.status === "Dikembalikan"
    : false;
  const canReview = detail?.status === "Dikirim";
  const canManage = detail
    ? detail.status !== "Final" &&
      detail.status !== "Dikecualikan" &&
      detail.status !== "Tidak lengkap" &&
      detail.periodStatus === "Terbuka"
    : false;

  return (
    <>
      <DetailDrawer
        open={open}
        title={detail ? detail.employeeName : "Rincian Penilaian"}
        description={
          detail
            ? `${formatReviewPeriod(detail.periodStartDate, detail.periodEndDate)} · ${detail.periodName}`
            : undefined
        }
        size="lg"
        onClose={onClose}
        footer={
          detail ? (
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Link
                  className="btn btn-g"
                  href={`/performance/tim/${detail.id}`}
                >
                  Isi sebagai Penilai
                </Link>
              )}
              {canManage && (
                <button
                  type="button"
                  className="btn btn-g"
                  onClick={() => setDialog("reviewer")}
                  disabled={busy}
                >
                  Ganti Penilai
                </button>
              )}
              {canReview && (
                <>
                  <button
                    type="button"
                    className="btn btn-g"
                    onClick={() => setDialog("return")}
                    disabled={busy}
                  >
                    Kembalikan
                  </button>
                  <button
                    type="button"
                    className="btn btn-p"
                    onClick={() => setDialog("approve")}
                    disabled={busy}
                  >
                    Setujui
                  </button>
                </>
              )}
              {canManage && (
                <button
                  type="button"
                  className="btn btn-g"
                  onClick={() => setDialog("exclude")}
                  disabled={busy}
                >
                  Kecualikan
                </button>
              )}
            </div>
          ) : undefined
        }
      >
        {loading && <div className="sub text-[13px]">Memuat lembar penilaian…</div>}
        {error && <div className="tag t-bad w-full justify-center mb-3">{error}</div>}
        {detail && (
          <>
            <FormSection
              icon="users"
              title="Karyawan dan Penilai"
              description="Snapshot saat periode dibuka."
            >
              <InfoGrid>
                <InfoItem label="Karyawan" value={detail.employeeName} />
                <InfoItem label="Employee ID" value={detail.employeeId} />
                <InfoItem label="Departemen" value={detail.department} />
                <InfoItem label="Jabatan" value={detail.position} />
                <InfoItem
                  label="Penilai"
                  value={reviewerLabel(detail.reviewerName)}
                />
                <InfoItem
                  label="Status"
                  value={<PerformanceStatusTag status={detail.status} />}
                />
                <InfoItem
                  label="Batas pengisian"
                  value={formatDateID(detail.periodDueDate)}
                />
                <InfoItem
                  label="Skor akhir"
                  value={
                    detail.finalScore !== null && detail.finalCategory ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <b>{formatPerformanceScore(detail.finalScore)}</b>
                        <PerformanceCategoryTag category={detail.finalCategory} />
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
              </InfoGrid>
              {detail.status === "Dikembalikan" && detail.returnReason && (
                <div
                  className="card p-3 mt-3 text-[12px]"
                  style={{
                    background: "#FFF7E6",
                    borderColor: "#E8D3B8",
                    color: "#8A5A12",
                  }}
                >
                  Dikembalikan: {detail.returnReason}
                </div>
              )}
              {detail.status === "Dikecualikan" && detail.excludedReason && (
                <div className="text-[11px] sub mt-3">
                  Dikecualikan: {detail.excludedReason}
                </div>
              )}
            </FormSection>

            <FormSection
              icon="target"
              title="Skor Aspek"
              description="Skala 1–5; catatan wajib untuk skor 1, 2, dan 5."
            >
              <div className="flex flex-col gap-2">
                {detail.scores.map((score) => (
                  <div className="card p-3" key={score.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-[13px]">
                          {score.aspectName}
                        </div>
                        <div className="text-[11px] sub">
                          {score.aspectDescription}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-[16px]">
                          {score.score ?? "—"}
                        </div>
                        <div className="text-[10px] sub">
                          {score.score ? scoreLabel(score.score) : "Belum dinilai"}
                        </div>
                      </div>
                    </div>
                    {score.note && (
                      <div className="text-[12px] mt-2 whitespace-pre-line">
                        {score.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </FormSection>

            <FormSection icon="rep" title="Catatan Penilai">
              <InfoGrid single>
                <InfoItem
                  label="Catatan Pencapaian Utama"
                  value={detail.achievementNotes || "—"}
                />
                <InfoItem label="Kekuatan" value={detail.strengths || "—"} />
                <InfoItem
                  label="Area Perbaikan"
                  value={detail.improvementAreas || "—"}
                />
                <InfoItem
                  label="Catatan Umum"
                  value={detail.generalNotes || "—"}
                />
              </InfoGrid>
            </FormSection>

            <FormSection icon="clock" title="Riwayat">
              {detail.history.length === 0 ? (
                <div className="sub text-[12px]">Belum ada riwayat.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {detail.history.map((entry) => (
                    <div className="text-[12px]" key={entry.id}>
                      <b>{entry.action}</b>
                      {entry.toStatus ? ` · ${entry.toStatus}` : ""} ·{" "}
                      {entry.actorName} · {formatDateTimeID(entry.actedAt)}
                      {entry.reason && (
                        <div className="text-[11px] sub">{entry.reason}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </FormSection>
          </>
        )}
      </DetailDrawer>

      <PerformanceReasonDialog
        open={dialog === "return"}
        title="Kembalikan Penilaian"
        description="Penilai dapat memperbaiki lalu mengirim ulang lembar ini."
        label="Alasan pengembalian"
        confirmLabel="Kembalikan"
        busy={busy}
        error={dialog === "return" ? error : undefined}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void runAction("return", { reason }, "Penilaian dikembalikan")}
      />
      <PerformanceReasonDialog
        open={dialog === "exclude"}
        title="Kecualikan Lembar"
        description="Lembar yang dikecualikan tidak ikut hitungan hasil periode."
        label="Alasan pengecualian"
        confirmLabel="Kecualikan"
        busy={busy}
        danger
        error={dialog === "exclude" ? error : undefined}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void runAction("exclude", { reason }, "Lembar dikecualikan")}
      />
      <ConfirmDialog
        title="Setujui Penilaian?"
        description="Setelah disetujui, lembar berstatus Final dan terkunci permanen."
        confirmLabel="Setujui"
        busy={busy}
        error={dialog === "approve" ? error : undefined}
        onClose={() => setDialog(null)}
        onConfirm={() => void runAction("approve", undefined, "Penilaian disetujui")}
      />
      {detail && (
        <PerformanceReviewerDialog
          open={dialog === "reviewer"}
          reviewId={detail.id}
          employeeId={detail.employeeId}
          employeeName={detail.employeeName}
          currentReviewerId={detail.reviewerEmployeeId}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            onMutated(message);
            void load();
          }}
        />
      )}
    </>
  );
}
