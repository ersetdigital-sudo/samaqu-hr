"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { PerformanceReviewDrawer } from "@/components/performance/performance-review-drawer";
import {
  PerformancePeriodStatusTag,
  PerformanceStatusTag,
} from "@/components/performance/performance-tags";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID } from "@/lib/datetime";
import {
  filterPerformanceReviews,
  formatPerformanceScore,
  formatReviewPeriod,
  performanceDepartmentOptions,
  performanceReviewerOptions,
  reviewerLabel,
} from "@/lib/performance/rules";
import type {
  PerformancePeriodDetail,
  PerformanceReviewFilters,
  PerformanceReviewSummary,
} from "@/lib/performance/types";

const DEFAULT_FILTERS: PerformanceReviewFilters = {
  q: "",
  department: "Semua",
  status: "Semua",
  reviewer: "Semua",
};

export function PerformancePeriodDetailView({
  initialDetail,
}: {
  initialDetail: PerformancePeriodDetail;
}) {
  const { toast } = useRecruitment();
  const [detail, setDetail] = useState(initialDetail);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { period, reviews } = detail;

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/performance/periods/${period.id}`, {
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as
      | (PerformancePeriodDetail & { error?: string })
      | null;
    if (!response.ok || !body) {
      throw new Error(body?.error ?? "Gagal memuat periode");
    }
    setDetail(body);
  }, [period.id]);

  const departments = useMemo(
    () => performanceDepartmentOptions(reviews),
    [reviews]
  );
  const reviewers = useMemo(
    () => performanceReviewerOptions(reviews),
    [reviews]
  );
  const rows = useMemo(
    () => filterPerformanceReviews(reviews, filters),
    [reviews, filters]
  );

  const setFilter = <K extends keyof PerformanceReviewFilters>(
    key: K,
    value: PerformanceReviewFilters[K]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const closePeriod = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/performance/periods/${period.id}/close`,
        { method: "POST" }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal menutup periode");
      }
      setCloseOpen(false);
      await refresh();
      toast("Periode ditutup. Hasil Final dapat dilihat karyawan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menutup periode");
    } finally {
      setBusy(false);
    }
  };

  const cards = [
    { label: "Total Lembar", value: period.reviewCount },
    { label: "Draft", value: period.counts.Draft },
    { label: "Dikirim", value: period.counts.Dikirim },
    { label: "Dikembalikan", value: period.counts.Dikembalikan },
    { label: "Final", value: period.counts.Final },
    { label: "Dikecualikan", value: period.counts.Dikecualikan },
  ];

  const columns: DataTableColumn<PerformanceReviewSummary>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "24%",
      render: (review) => (
        <TwoLineCell
          primary={review.employeeName}
          secondary={`${review.department} · ${review.employeeId}`}
        />
      ),
    },
    {
      key: "reviewer",
      label: "Penilai",
      width: "18%",
      render: (review) => (
        <span className="text-[13px]">{reviewerLabel(review.reviewerName)}</span>
      ),
    },
    {
      key: "score",
      label: "Skor Akhir",
      width: "13%",
      render: (review) => (
        <span className="text-[13px]">
          {formatPerformanceScore(review.finalScore)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "16%",
      render: (review) => <PerformanceStatusTag status={review.status} />,
    },
    {
      key: "updated",
      label: "Diperbarui",
      width: "15%",
      render: (review) => (
        <span className="text-[12px]">{formatDateID(review.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      label: "Aksi",
      width: "14%",
      render: (review) => (
        <button
          type="button"
          className="btn btn-g !py-1 !px-2 !text-[11px]"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedId(review.id);
          }}
        >
          Detail
        </button>
      ),
    },
  ];

  const willBeIncomplete =
    period.reviewCount - period.counts.Final - period.counts.Dikecualikan;

  return (
    <>
      <PageHead
        title={period.name}
        subtitle={`${formatReviewPeriod(period.startDate, period.endDate)} · batas pengisian ${formatDateID(period.dueDate)}`}
      >
        <Link className="btn btn-g" href="/performance/periode">
          Kembali
        </Link>
        <button
          type="button"
          className="btn btn-g"
          onClick={() =>
            void refresh().catch((err) =>
              toast(err instanceof Error ? err.message : "Gagal memuat periode")
            )
          }
        >
          Muat ulang
        </button>
        {period.status === "Terbuka" && (
          <button
            type="button"
            className="btn btn-p"
            onClick={() => {
              setError("");
              setCloseOpen(true);
            }}
          >
            Tutup Periode
          </button>
        )}
      </PageHead>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <PerformancePeriodStatusTag status={period.status} />
        {period.status === "Ditutup" && (
          <span className="text-[11px] sub">
            Periode ditutup {formatDateID(period.closedAt)}. Lembar yang belum
            Final berstatus Tidak lengkap dan tidak ikut hasil.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-3 mb-4">
        {cards.map((card) => (
          <div className="card p-3" key={card.label}>
            <div className="text-[11px] sub font-semibold">{card.label}</div>
            <div className="text-[19px] font-bold mt-1">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="card p-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-[12px] font-semibold">Progres Final</div>
          <div className="text-[12px]">
            {period.counts.Final} dari {period.reviewCount} lembar
          </div>
        </div>
        <div
          className="h-2.5 rounded-full overflow-hidden"
          style={{ background: "var(--line)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${period.progressPercent}%`,
              background: "var(--p)",
            }}
          />
        </div>
      </div>

      {period.ineligible.length > 0 && (
        <div className="card p-4 mb-5">
          <div className="font-bold text-[13px] mb-1">
            Karyawan tidak memenuhi syarat
          </div>
          <div className="text-[11px] sub mb-3">
            Tidak dibuatkan lembar pada periode ini.
          </div>
          <div className="flex flex-col gap-1">
            {period.ineligible.map((employee) => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 text-[12px]"
                key={employee.employeeId}
              >
                <span>
                  {employee.employeeName}{" "}
                  <span className="sub">· {employee.employeeId}</span>
                </span>
                <span className="tag t-mute">{employee.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <div className="font-bold">Lembar Penilaian</div>
            <div className="text-[11px] sub">
              Snapshot penilai dikunci saat periode dibuka; HR dapat mengganti
              selama periode Terbuka.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="inp !w-52"
              placeholder="Cari nama / ID / jabatan"
              value={filters.q}
              onChange={(event) => setFilter("q", event.target.value)}
              aria-label="Cari lembar penilaian"
            />
            <select
              className="inp !w-auto"
              value={filters.department}
              onChange={(event) => setFilter("department", event.target.value)}
              aria-label="Filter departemen"
            >
              <option value="Semua">Semua departemen</option>
              {departments.map((department) => (
                <option value={department} key={department}>
                  {department}
                </option>
              ))}
            </select>
            <select
              className="inp !w-auto"
              value={filters.status}
              onChange={(event) => setFilter("status", event.target.value)}
              aria-label="Filter status"
            >
              <option value="Semua">Semua status</option>
              {[
                "Draft",
                "Dikirim",
                "Dikembalikan",
                "Final",
                "Dikecualikan",
                "Tidak lengkap",
              ].map((status) => (
                <option value={status} key={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              className="inp !w-auto"
              value={filters.reviewer}
              onChange={(event) => setFilter("reviewer", event.target.value)}
              aria-label="Filter penilai"
            >
              <option value="Semua">Semua penilai</option>
              {reviewers.map((reviewer) => (
                <option value={reviewer} key={reviewer}>
                  {reviewer}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DataTable
          ariaLabel="Lembar penilaian periode"
          columns={columns}
          rows={rows}
          rowKey={(review) => review.id}
          rowLabel={(review) => `Buka penilaian ${review.employeeName}`}
          onRowActivate={(review) => setSelectedId(review.id)}
          rowAction={{
            ariaLabel: (review) => `Buka penilaian ${review.employeeName}`,
            label: "Buka penilaian",
          }}
          empty="Tidak ada lembar yang cocok dengan filter."
          minWidth={980}
        />
      </div>

      <PerformanceReviewDrawer
        reviewId={selectedId}
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        onMutated={(message) => {
          toast(message);
          void refresh().catch(() => undefined);
        }}
      />

      <ConfirmDialog
        title="Tutup Periode?"
        description={`${willBeIncomplete} lembar akan menjadi Tidak lengkap karena belum Final. Lembar Final dan Dikecualikan tidak diubah. Periode tidak dapat dibuka kembali.`}
        confirmLabel="Tutup Periode"
        busy={busy}
        error={closeOpen ? error : undefined}
        onClose={() => setCloseOpen(false)}
        onConfirm={() => void closePeriod()}
        danger
      />
    </>
  );
}
