"use client";

import { useState } from "react";
import { PageHead } from "@/components/page-head";
import {
  PerformanceCategoryTag,
} from "@/components/performance/performance-tags";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoGrid, InfoItem } from "@/components/ui/detail-info";
import { FormSection } from "@/components/ui/form-section";
import {
  formatPerformanceScore,
  formatReviewPeriod,
  scoreLabel,
} from "@/lib/performance/rules";
import type { MyPerformanceResult } from "@/lib/performance/types";

export function PerformanceMyResultsView({
  results,
  linked,
}: {
  results: MyPerformanceResult[];
  linked: boolean;
}) {
  const [selected, setSelected] = useState<MyPerformanceResult | null>(null);

  return (
    <>
      <PageHead
        title="Penilaian Saya"
        subtitle="Hasil penilaian Final dari periode yang sudah ditutup."
      />

      {!linked ? (
        <div className="card p-8 text-center max-w-[680px]">
          <div className="font-semibold text-[15px]">
            Akun ini belum tertaut ke data karyawan
          </div>
          <div className="sub text-[13px] mt-2">
            Hasil penilaian hanya dapat ditampilkan untuk akun yang memiliki
            Employee ID.
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="card p-8 text-center max-w-[680px]">
          <div className="font-semibold text-[15px]">Belum ada hasil penilaian</div>
          <div className="sub text-[13px] mt-2">
            Hasil akan muncul setelah lembar berstatus Final dan periode
            ditutup oleh HR.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-[860px]">
          {results.map((result) => (
            <button
              type="button"
              key={result.reviewId}
              className="card p-5 text-left flex flex-wrap items-center justify-between gap-3"
              onClick={() => setSelected(result)}
            >
              <div>
                <div className="font-bold">{result.periodName}</div>
                <div className="text-[11px] sub">
                  {formatReviewPeriod(result.periodStartDate, result.periodEndDate)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] sub">Skor Akhir</div>
                  <div className="text-[20px] font-bold">
                    {formatPerformanceScore(result.finalScore)}
                  </div>
                </div>
                <PerformanceCategoryTag category={result.finalCategory} />
                <span className="tag t-info">Lihat hasil</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <DetailDrawer
        open={Boolean(selected)}
        title={selected?.periodName ?? "Hasil Penilaian"}
        description={
          selected
            ? formatReviewPeriod(selected.periodStartDate, selected.periodEndDate)
            : undefined
        }
        size="lg"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <FormSection icon="target" title="Skor Akhir">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-[28px] font-bold">
                  {formatPerformanceScore(selected.finalScore)}
                </div>
                <PerformanceCategoryTag category={selected.finalCategory} />
              </div>
            </FormSection>

            <FormSection icon="rep" title="Skor per Aspek">
              <div className="flex flex-col gap-2">
                {selected.scores.map((score) => (
                  <div className="card p-3" key={score.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-[13px]">
                          {score.aspectName}
                        </div>
                        <div className="text-[11px] sub">
                          {score.aspectDescription}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[16px]">
                          {score.score ?? "—"}
                        </div>
                        <div className="text-[10px] sub">
                          {score.score ? scoreLabel(score.score) : "—"}
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

            <FormSection icon="rep" title="Catatan">
              <InfoGrid single>
                <InfoItem
                  label="Catatan Pencapaian Utama"
                  value={selected.achievementNotes || "—"}
                />
                <InfoItem label="Kekuatan" value={selected.strengths || "—"} />
                <InfoItem
                  label="Area Perbaikan"
                  value={selected.improvementAreas || "—"}
                />
                <InfoItem
                  label="Catatan Umum"
                  value={selected.generalNotes || "—"}
                />
              </InfoGrid>
            </FormSection>
          </>
        )}
      </DetailDrawer>
    </>
  );
}
