"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/overview/empty-state";
import { useRecruitment } from "@/components/recruitment-provider";
import type { PipelineMetric } from "@/lib/recruitment/types";

/**
 * Funnel pipeline. Tinggi batang, jumlah, dan konversi dihitung dari kandidat
 * aktual (lihat `buildPipelineMetrics`), bukan angka tetap.
 */
export function PipelineCard({ metrics }: { metrics: PipelineMetric[] }) {
  const router = useRouter();
  const { setPipeFilter } = useRecruitment();

  const total = metrics.reduce((sum, metric) => sum + metric.count, 0);
  const max = Math.max(1, ...metrics.map((metric) => metric.count));

  const openPipeline = () => {
    setPipeFilter("Semua");
    router.push("/recruitment/pipeline");
  };

  return (
    <div className="card p-6 mb-6">
      <div className="flex justify-between items-center mb-5">
        <div>
          <div className="font-bold text-[16px]">Pipeline Rekrutmen</div>
          <div className="sub text-[13px]">
            Semua lowongan aktif · konversi antar tahap
          </div>
        </div>
        <button className="btn btn-g" onClick={openPipeline}>
          Buka Pipeline
        </button>
      </div>

      {total === 0 ? (
        <EmptyState>Belum ada kandidat di pipeline.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {metrics.map((metric, i) => (
            <div
              key={metric.stage}
              className="cursor-pointer"
              onClick={openPipeline}
            >
              <div className="flex justify-between text-[12px] mb-2">
                <span className="font-semibold">{metric.stage}</span>
                {metric.conversion !== null ? (
                  <span className="sub">{`${metric.conversion}%`}</span>
                ) : null}
              </div>
              <div
                className="rounded-xl flex items-end"
                style={{ height: 96, background: "#F6F2F0" }}
              >
                <div
                  className="w-full rounded-xl"
                  style={{
                    height: `${(metric.count / max) * 100}%`,
                    background:
                      i === metrics.length - 1
                        ? "var(--pink)"
                        : `rgba(17,17,17,${0.12 + i * 0.12})`,
                  }}
                />
              </div>
              <div className="text-[22px] font-bold mt-2">{metric.count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
