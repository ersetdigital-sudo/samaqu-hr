"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import {
  formatMonthYearID,
  formatDateID,
} from "@/lib/datetime";
import {
  formatRupiah,
  payrollRunStatusTone,
} from "@/lib/payroll/rules";
import type { PayrollRun } from "@/lib/payroll/types";

export function PayrollOverviewView({
  initialRuns,
  todayIso,
}: {
  initialRuns: PayrollRun[];
  todayIso: string;
}) {
  const router = useRouter();
  const { toast } = useRecruitment();
  const [runs, setRuns] = useState(initialRuns);
  const [month, setMonth] = useState(todayIso.slice(0, 7));
  const [creating, setCreating] = useState(false);
  const latest = runs[0] ?? null;

  const refresh = useCallback(async () => {
    const response = await fetch("/api/payroll/runs", { cache: "no-store" });
    const body = (await response.json().catch(() => null)) as {
      runs?: PayrollRun[];
      error?: string;
    } | null;
    if (!response.ok || !body?.runs) {
      throw new Error(body?.error ?? "Gagal memuat run payroll");
    }
    setRuns(body.runs);
  }, []);

  const createRun = async () => {
    setCreating(true);
    try {
      const response = await fetch("/api/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodMonth: month }),
      });
      const body = (await response.json().catch(() => null)) as {
        runId?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.runId) {
        throw new Error(body?.error ?? "Gagal membuat run payroll");
      }
      toast("Run payroll dibuat dan dihitung");
      await refresh();
      router.push(`/payroll/runs/${body.runId}`);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Gagal membuat run payroll"
      );
    } finally {
      setCreating(false);
    }
  };

  const columns: DataTableColumn<PayrollRun>[] = [
    {
      key: "period",
      label: "Periode",
      width: "14%",
      render: (run) => (
        <span className="text-[13px] font-semibold">
          {formatMonthYearID(run.periodMonth)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "12%",
      render: (run) => (
        <span className={`tag ${payrollRunStatusTone(run.status)}`}>
          {run.status}
        </span>
      ),
    },
    {
      key: "employees",
      label: "Karyawan",
      width: "10%",
      render: (run) => <span className="text-[13px]">{run.employeeCount}</span>,
    },
    {
      key: "gross",
      label: "Bruto",
      width: "16%",
      render: (run) => <span className="text-[13px]">{formatRupiah(run.grossTotal)}</span>,
    },
    {
      key: "deduction",
      label: "Potongan",
      width: "15%",
      render: (run) => (
        <span className="text-[13px]">{formatRupiah(run.deductionTotal)}</span>
      ),
    },
    {
      key: "thp",
      label: "Take Home Pay",
      width: "17%",
      render: (run) => (
        <b className="text-[13px]">{formatRupiah(run.takeHomeTotal)}</b>
      ),
    },
    {
      key: "created",
      label: "Dibuat",
      width: "16%",
      render: (run) => (
        <TwoLineCell
          primary={formatDateID(run.createdAt)}
          secondary={run.paidDate ? `Dibayar ${formatDateID(run.paidDate)}` : ""}
        />
      ),
    },
  ];

  const summary = [
    { label: "Total Gaji Bruto", value: latest ? formatRupiah(latest.grossTotal) : "—" },
    { label: "Total Potongan", value: latest ? formatRupiah(latest.deductionTotal) : "—" },
    { label: "Take Home Pay", value: latest ? formatRupiah(latest.takeHomeTotal) : "—" },
    { label: "Biaya Perusahaan", value: latest ? formatRupiah(latest.employerCostTotal) : "—" },
    { label: "Jumlah Karyawan", value: latest ? latest.employeeCount : "—" },
    { label: "Status Run", value: latest ? latest.status : "—" },
  ];

  return (
    <>
      <PageHead
        title="Payroll"
        subtitle="Run penggajian bulanan dari Rekap Kehadiran, Lembur, dan profil gaji."
      >
        <input
          type="month"
          className="inp !w-auto"
          value={month}
          disabled={creating}
          onChange={(event) => setMonth(event.target.value)}
          aria-label="Periode payroll baru"
        />
        <button
          type="button"
          className="btn btn-p"
          onClick={() => void createRun()}
          disabled={creating || !month}
        >
          {creating ? "Menghitung…" : "Buat Run"}
        </button>
      </PageHead>

      {latest && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="text-[12px] sub">
            Ringkasan run terbaru: {formatMonthYearID(latest.periodMonth)}
          </div>
          <span className={`tag ${payrollRunStatusTone(latest.status)}`}>
            {latest.status}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4 mb-5">
        {summary.map((card) => (
          <div className="card p-4" key={card.label}>
            <div className="text-[11px] sub font-semibold">{card.label}</div>
            <div className="text-[20px] font-bold tracking-tight mt-1 break-words">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="font-bold">Daftar Run</div>
            <div className="text-[11px] sub">
              Satu periode hanya memiliki satu run aktif. Run lama berstatus
              Direvisi tetap ditampilkan sebagai arsip.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-g"
            onClick={() => void refresh().catch((error) =>
              toast(error instanceof Error ? error.message : "Gagal memuat run")
            )}
          >
            Muat ulang
          </button>
        </div>
        <DataTable
          ariaLabel="Daftar payroll run"
          columns={columns}
          rows={runs}
          rowKey={(run) => run.id}
          rowLabel={(run) =>
            `Buka payroll ${formatMonthYearID(run.periodMonth)}`
          }
          onRowActivate={(run) => router.push(`/payroll/runs/${run.id}`)}
          rowAction={{
            ariaLabel: (run) =>
              `Buka payroll ${formatMonthYearID(run.periodMonth)}`,
            label: "Buka run",
          }}
          empty="Belum ada payroll run."
          minWidth={980}
        />
      </div>
    </>
  );
}
