"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { PerformancePeriodStatusTag } from "@/components/performance/performance-tags";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { FormDrawer } from "@/components/ui/form-drawer";
import { formatDateID } from "@/lib/datetime";
import type { PerformancePeriodSummary } from "@/lib/performance/types";

export function PerformancePeriodsView({
  initialPeriods,
}: {
  initialPeriods: PerformancePeriodSummary[];
}) {
  const router = useRouter();
  const { toast } = useRecruitment();
  const [periods, setPeriods] = useState(initialPeriods);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    const openPeriod = periods.find((period) => period.status === "Terbuka");
    return [
      { label: "Periode Terbuka", value: openPeriod ? "1" : "0" },
      {
        label: "Lembar Periode Aktif",
        value: openPeriod ? openPeriod.reviewCount : "—",
      },
      { label: "Total Periode", value: periods.length },
      {
        label: "Final di Periode Aktif",
        value: openPeriod ? openPeriod.counts.Final : "—",
      },
    ];
  }, [periods]);

  const refresh = async () => {
    const response = await fetch("/api/performance/periods", {
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as {
      periods?: PerformancePeriodSummary[];
      error?: string;
    } | null;
    if (!response.ok || !body?.periods) {
      throw new Error(body?.error ?? "Gagal memuat periode");
    }
    setPeriods(body.periods);
  };

  const submit = async () => {
    if (!name.trim() || !startDate || !endDate || !dueDate) {
      setError("Nama, tanggal mulai, tanggal akhir, dan batas pengisian wajib diisi.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/performance/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          startDate,
          endDate,
          dueDate,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        periods?: PerformancePeriodSummary[];
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal membuka periode");
      }
      setPeriods(body?.periods ?? periods);
      setOpen(false);
      setName("");
      setStartDate("");
      setEndDate("");
      setDueDate("");
      toast("Periode penilaian dibuka");
      await refresh().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuka periode");
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<PerformancePeriodSummary>[] = [
    {
      key: "period",
      label: "Periode",
      width: "26%",
      render: (period) => (
        <TwoLineCell
          primary={period.name}
          secondary={`${formatDateID(period.startDate)} – ${formatDateID(period.endDate)}`}
        />
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "12%",
      render: (period) => <PerformancePeriodStatusTag status={period.status} />,
    },
    {
      key: "reviews",
      label: "Lembar",
      width: "18%",
      render: (period) => (
        <TwoLineCell
          primary={`${period.reviewCount} lembar`}
          secondary={`${period.counts.Final} final · ${period.counts.Dikirim} dikirim`}
        />
      ),
    },
    {
      key: "progress",
      label: "Progres Final",
      width: "20%",
      render: (period) => (
        <div className="flex items-center gap-2">
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: "var(--line)", width: 92 }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${period.progressPercent}%`,
                background: "var(--p)",
              }}
            />
          </div>
          <span className="text-[12px]">{period.progressPercent}%</span>
        </div>
      ),
    },
    {
      key: "due",
      label: "Batas Pengisian",
      width: "14%",
      render: (period) => (
        <span className="text-[13px]">{formatDateID(period.dueDate)}</span>
      ),
    },
    {
      key: "actions",
      label: "Aksi",
      width: "10%",
      render: (period) => (
        <button
          type="button"
          className="btn btn-g !py-1 !px-2 !text-[11px]"
          onClick={(event) => {
            event.stopPropagation();
            router.push(`/performance/periode/${period.id}`);
          }}
        >
          Buka
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title="Performance Management"
        subtitle="Kelola periode penilaian semester, pantau progres, dan tinjau hasil atasan."
      >
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
        <button
          type="button"
          className="btn btn-p"
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          Buka Periode
        </button>
      </PageHead>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {stats.map((card) => (
          <div className="card p-4" key={card.label}>
            <div className="text-[11px] sub font-semibold">{card.label}</div>
            <div className="text-[20px] font-bold tracking-tight mt-1">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="font-bold">Daftar Periode</div>
            <div className="text-[11px] sub">
              Hanya satu periode dapat berstatus Terbuka. Rentang tanggal tidak
              boleh bertabrakan.
            </div>
          </div>
        </div>
        <DataTable
          ariaLabel="Daftar periode penilaian"
          columns={columns}
          rows={periods}
          rowKey={(period) => period.id}
          rowLabel={(period) => `Buka periode ${period.name}`}
          onRowActivate={(period) =>
            router.push(`/performance/periode/${period.id}`)
          }
          rowAction={{
            ariaLabel: (period) => `Buka periode ${period.name}`,
            label: "Buka periode",
          }}
          empty="Belum ada periode penilaian."
          minWidth={980}
        />
      </div>

      <FormDrawer
        open={open}
        title="Buka Periode Penilaian"
        description="Sistem akan membuat lembar Draft untuk karyawan Aktif/Probation dengan masa kerja minimal 3 bulan."
        size="md"
        busy={busy}
        onRequestClose={() => setOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-g"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-p"
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? "Membuka…" : "Buka Periode"}
            </button>
          </>
        }
      >
        {error && (
          <div className="tag t-bad w-full justify-center mb-4">{error}</div>
        )}
        <label className="block mb-3">
          <span className="lbl">Nama periode *</span>
          <input
            className="inp"
            value={name}
            maxLength={160}
            placeholder="Contoh: Semester 2 2026"
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="lbl">Tanggal mulai *</span>
            <input
              type="date"
              className="inp"
              value={startDate}
              disabled={busy}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="lbl">Tanggal akhir *</span>
            <input
              type="date"
              className="inp"
              value={endDate}
              disabled={busy}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="lbl">Batas pengisian *</span>
            <input
              type="date"
              className="inp"
              value={dueDate}
              disabled={busy}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>
        </div>
        <div className="text-[11px] sub mt-3">
          Karyawan Nonaktif dan masa kerja di bawah 3 bulan tidak dibuatkan
          lembar; keduanya tercatat sebagai pengecualian pada ringkasan periode.
        </div>
      </FormDrawer>
    </>
  );
}
