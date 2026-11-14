"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  PerformanceCategoryTag,
  PerformanceStatusTag,
} from "@/components/performance/performance-tags";
import { FormSection } from "@/components/ui/form-section";
import { formatDateID } from "@/lib/datetime";
import {
  formatPerformanceScore,
  formatReviewPeriod,
  performanceAverage,
  performanceCategory,
  performanceReviewIssues,
  reviewerLabel,
  scoreLabel,
  scoreNeedsNote,
} from "@/lib/performance/rules";
import type {
  PerformanceReviewDetail,
  PerformanceReviewScoreInput,
} from "@/lib/performance/types";

type ScoreState = Record<string, { score: number | null; note: string }>;

const SCORES = [1, 2, 3, 4, 5] as const;

function buildState(detail: PerformanceReviewDetail): ScoreState {
  return Object.fromEntries(
    detail.scores.map((score) => [
      score.id,
      { score: score.score, note: score.note },
    ])
  );
}

export function PerformanceReviewForm({
  initialDetail,
  substitute,
}: {
  initialDetail: PerformanceReviewDetail;
  substitute: boolean;
}) {
  const router = useRouter();
  const { toast } = useRecruitment();
  const [detail, setDetail] = useState(initialDetail);
  const [scores, setScores] = useState<ScoreState>(() =>
    buildState(initialDetail)
  );
  const [achievementNotes, setAchievementNotes] = useState(
    initialDetail.achievementNotes
  );
  const [strengths, setStrengths] = useState(initialDetail.strengths);
  const [improvementAreas, setImprovementAreas] = useState(
    initialDetail.improvementAreas
  );
  const [generalNotes, setGeneralNotes] = useState(initialDetail.generalNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const editable =
    detail.periodStatus === "Terbuka" &&
    (detail.status === "Draft" || detail.status === "Dikembalikan");

  useEffect(() => {
    setDetail(initialDetail);
    setScores(buildState(initialDetail));
    setAchievementNotes(initialDetail.achievementNotes);
    setStrengths(initialDetail.strengths);
    setImprovementAreas(initialDetail.improvementAreas);
    setGeneralNotes(initialDetail.generalNotes);
  }, [initialDetail]);

  const scoreValues = detail.scores.map(
    (score) => scores[score.id]?.score ?? null
  );
  const average = useMemo(
    () => performanceAverage(scoreValues),
    [scoreValues]
  );
  const category = average === null ? null : performanceCategory(average);

  const setScore = (id: string, value: number) => {
    setScores((current) => ({
      ...current,
      [id]: { score: value, note: current[id]?.note ?? "" },
    }));
    setError("");
  };

  const setNote = (id: string, note: string) => {
    setScores((current) => ({
      ...current,
      [id]: { score: current[id]?.score ?? null, note },
    }));
    setError("");
  };

  const draftPayload = () => ({
    scores: detail.scores.map(
      (score): PerformanceReviewScoreInput => ({
        scoreId: score.id,
        score: scores[score.id]?.score ?? null,
        note: scores[score.id]?.note ?? "",
      })
    ),
    achievementNotes,
    strengths,
    improvementAreas,
    generalNotes,
  });

  const refresh = async () => {
    const response = await fetch(`/api/performance/reviews/${detail.id}`, {
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as
      | (PerformanceReviewDetail & { error?: string })
      | null;
    if (!response.ok || !body) {
      throw new Error(body?.error ?? "Gagal memuat lembar penilaian");
    }
    setDetail(body);
  };

  const saveDraft = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/performance/reviews/${detail.id}/draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload()),
        }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal menyimpan draft");
      }
      await refresh();
      toast("Draft penilaian disimpan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan draft");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setSubmitAttempted(true);
    const issues = performanceReviewIssues({
      scores: detail.scores.map((score) => ({
        ...score,
        score: scores[score.id]?.score ?? null,
        note: scores[score.id]?.note ?? "",
      })),
      achievementNotes,
    });
    if (issues.length > 0) {
      setError(issues.join(" "));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const draftResponse = await fetch(
        `/api/performance/reviews/${detail.id}/draft`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftPayload()),
        }
      );
      const draftBody = (await draftResponse.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!draftResponse.ok) {
        throw new Error(draftBody?.error ?? "Gagal menyimpan penilaian");
      }
      const response = await fetch(
        `/api/performance/reviews/${detail.id}/submit`,
        { method: "POST" }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal mengirim penilaian");
      }
      toast("Penilaian dikirim ke HR");
      router.push("/performance/tim");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim penilaian");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        title={`Penilaian ${detail.employeeName}`}
        subtitle={`${detail.periodName} · ${formatReviewPeriod(detail.periodStartDate, detail.periodEndDate)}`}
      >
        <Link className="btn btn-g" href="/performance/tim">
          Kembali
        </Link>
        {editable && (
          <>
            <button
              type="button"
              className="btn btn-g"
              onClick={() => void saveDraft()}
              disabled={busy}
            >
              {busy ? "Memproses…" : "Simpan Draft"}
            </button>
            <button
              type="button"
              className="btn btn-p"
              onClick={() => void submit()}
              disabled={busy}
            >
              Kirim ke HR
            </button>
          </>
        )}
      </PageHead>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <PerformanceStatusTag status={detail.status} />
        <span className="text-[12px] sub">
          Penilai: {reviewerLabel(detail.reviewerName)} · Batas pengisian{" "}
          {formatDateID(detail.periodDueDate)}
        </span>
      </div>

      {detail.status === "Dikembalikan" && detail.returnReason && (
        <div
          className="card p-4 mb-4 text-[12px]"
          style={{
            background: "#FFF7E6",
            borderColor: "#E8D3B8",
            color: "#8A5A12",
          }}
        >
          <b>Dikembalikan HR:</b> {detail.returnReason}
        </div>
      )}

      {!editable && (
        <div className="card p-4 mb-4 text-[12px] sub">
          {detail.status === "Dikirim"
            ? "Lembar sudah dikirim dan sedang menunggu review HR."
            : detail.status === "Final"
              ? "Lembar sudah Final dan terkunci."
              : detail.status === "Dikecualikan"
                ? "Lembar dikecualikan dari hasil periode."
                : "Lembar tidak dapat diubah pada status ini."}
        </div>
      )}

      {substitute && editable && (
        <div className="text-[11px] sub mb-4">
          Anda mengisi sebagai HR/Admin penilai pengganti. Riwayat mencatat akun
          yang benar-benar mengisi.
        </div>
      )}

      {error && <div className="tag t-bad w-full justify-center mb-4">{error}</div>}

      <div className="card p-4 mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] sub font-semibold">Rata-rata Sementara</div>
          <div className="text-[22px] font-bold mt-1">
            {formatPerformanceScore(average)}
          </div>
        </div>
        {category && <PerformanceCategoryTag category={category} />}
        <div className="text-[11px] sub max-w-[420px]">
          Skor akhir dihitung dari rata-rata semua aspek dengan bobot sama,
          dibulatkan 2 desimal. Catatan wajib untuk skor 1, 2, dan 5.
        </div>
      </div>

      <FormSection
        icon="target"
        title="Aspek Penilaian"
        description="Pilih skor 1–5. Catatan wajib untuk skor 1, 2, dan 5 saat dikirim ke HR; Simpan Draft tetap bisa dilakukan tanpa catatan lengkap."
      >
        <div className="flex flex-col gap-4">
          {detail.scores.map((aspect) => {
            const current = scores[aspect.id] ?? {
              score: null,
              note: "",
            };
            return (
              <div className="card p-4" key={aspect.id}>
                <div className="font-semibold text-[13px]">{aspect.aspectName}</div>
                <div className="text-[11px] sub mb-3">
                  {aspect.aspectDescription}
                </div>
                <div className="flex flex-wrap gap-2">
                  {SCORES.map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={`btn ${
                        current.score === value ? "btn-p" : "btn-g"
                      } !py-1.5 !px-3 !text-[11px] text-left`}
                      disabled={!editable || busy}
                      onClick={() => setScore(aspect.id, value)}
                      aria-pressed={current.score === value}
                    >
                      <b className="mr-1">{value}</b> {scoreLabel(value)}
                    </button>
                  ))}
                </div>
                <label className="block mt-3">
                  <span className="lbl">
                    Catatan
                    {scoreNeedsNote(current.score) ? " *" : " (opsional)"}
                  </span>
                  <textarea
                    className="inp"
                    rows={2}
                    maxLength={2000}
                    value={current.note}
                    disabled={!editable || busy}
                    aria-invalid={
                      submitAttempted &&
                      scoreNeedsNote(current.score) &&
                      !current.note.trim()
                    }
                    style={
                      submitAttempted &&
                      scoreNeedsNote(current.score) &&
                      !current.note.trim()
                        ? { borderColor: "var(--bad)" }
                        : undefined
                    }
                    onChange={(event) => setNote(aspect.id, event.target.value)}
                  />
                  {submitAttempted &&
                    scoreNeedsNote(current.score) &&
                    !current.note.trim() && (
                      <span className="text-[11px]" style={{ color: "var(--bad)" }}>
                        Catatan wajib untuk skor {current.score}.
                      </span>
                    )}
                </label>
              </div>
            );
          })}
        </div>
      </FormSection>

      <FormSection
        icon="rep"
        title="Catatan Penilaian"
        description="Catatan Pencapaian Utama wajib diisi sebelum dikirim."
      >
        <label className="block mb-3">
          <span className="lbl">Catatan Pencapaian Utama *</span>
          <textarea
            className="inp"
            rows={4}
            maxLength={4000}
            value={achievementNotes}
            disabled={!editable || busy}
            onChange={(event) => setAchievementNotes(event.target.value)}
          />
        </label>
        <label className="block mb-3">
          <span className="lbl">Kekuatan</span>
          <textarea
            className="inp"
            rows={3}
            maxLength={4000}
            value={strengths}
            disabled={!editable || busy}
            onChange={(event) => setStrengths(event.target.value)}
          />
        </label>
        <label className="block mb-3">
          <span className="lbl">Area Perbaikan</span>
          <textarea
            className="inp"
            rows={3}
            maxLength={4000}
            value={improvementAreas}
            disabled={!editable || busy}
            onChange={(event) => setImprovementAreas(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="lbl">Catatan Umum</span>
          <textarea
            className="inp"
            rows={3}
            maxLength={4000}
            value={generalNotes}
            disabled={!editable || busy}
            onChange={(event) => setGeneralNotes(event.target.value)}
          />
        </label>
      </FormSection>
    </>
  );
}
