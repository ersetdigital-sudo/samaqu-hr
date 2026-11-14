"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { PayrollReasonDialog } from "@/components/payroll/payroll-reason-dialog";
import { PayrollRunEmployeeDrawer } from "@/components/payroll/payroll-run-employee-drawer";
import { PageHead } from "@/components/page-head";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID, formatMonthYearID } from "@/lib/datetime";
import {
  formatRupiah,
  payrollRunStatusTone,
} from "@/lib/payroll/rules";
import type {
  PayrollRunDetail,
  PayrollRunEmployee,
} from "@/lib/payroll/types";
import "@/components/recruitment-live/live.css";

type Dialog = "finalize" | "paid" | "revise" | null;

export function PayrollRunView({
  initialDetail,
}: {
  initialDetail: PayrollRunDetail;
}) {
  const router = useRouter();
  const { toast } = useRecruitment();
  const [detail, setDetail] = useState(initialDetail);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState("");

  const run = detail.run;
  const selected =
    detail.employees.find((employee) => employee.employeeId === selectedId) ??
    null;

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/payroll/runs/${run.id}`, {
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as
      | (PayrollRunDetail & { error?: string })
      | null;
    if (!response.ok || !body) {
      throw new Error(body?.error ?? "Gagal memuat detail run");
    }
    setDetail(body);
  }, [run.id]);

  const runAction = async (
    action: "recalculate" | "finalize" | "paid",
    successMessage: string
  ) => {
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(
        `/api/payroll/runs/${run.id}/${action}`,
        { method: "POST" }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal memproses payroll");
      }
      setDialog(null);
      await refresh();
      toast(successMessage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal memproses payroll";
      setActionError(message);
      toast(message);
    } finally {
      setBusy(false);
    }
  };

  const revise = async (reason: string) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(`/api/payroll/runs/${run.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await response.json().catch(() => null)) as {
        runId?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.runId) {
        throw new Error(body?.error ?? "Gagal membuat revisi payroll");
      }
      toast("Revisi payroll dibuat");
      router.push(`/payroll/runs/${body.runId}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal membuat revisi payroll";
      setActionError(message);
      toast(message);
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<PayrollRunEmployee>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "24%",
      render: (employee) => (
        <TwoLineCell
          primary={employee.employeeName}
          secondary={`${employee.department} · ${employee.employeeId}`}
        />
      ),
    },
    {
      key: "attendance",
      label: "Hari / Alfa",
      width: "12%",
      render: (employee) => (
        <TwoLineCell
          primary={`${employee.workdays} hari`}
          secondary={`${employee.alfaDays} alfa`}
        />
      ),
    },
    {
      key: "gross",
      label: "Pendapatan",
      width: "16%",
      render: (employee) => (
        <span className="text-[13px]">{formatRupiah(employee.grossIncome)}</span>
      ),
    },
    {
      key: "deduction",
      label: "Potongan",
      width: "16%",
      render: (employee) => (
        <span className="text-[13px]">
          {formatRupiah(employee.totalDeductions)}
        </span>
      ),
    },
    {
      key: "pph",
      label: "PPh 21",
      width: "14%",
      render: (employee) => (
        <span className="text-[13px]">{formatRupiah(employee.pph21)}</span>
      ),
    },
    {
      key: "thp",
      label: "Take Home Pay",
      width: "16%",
      render: (employee) => (
        <b className="text-[13px]">{formatRupiah(employee.takeHomePay)}</b>
      ),
    },
    {
      key: "status",
      label: "Kelengkapan",
      width: "14%",
      render: (employee) => (
        <span
          className={`tag ${
            employee.calcStatus === "Lengkap" ? "t-ok" : "t-warn"
          }`}
        >
          {employee.calcStatus}
        </span>
      ),
    },
  ];

  const summary = [
    { label: "Total Bruto", value: formatRupiah(run.grossTotal) },
    { label: "Total Potongan", value: formatRupiah(run.deductionTotal) },
    { label: "PPh 21", value: formatRupiah(run.pph21Total) },
    { label: "Take Home Pay", value: formatRupiah(run.takeHomeTotal) },
    { label: "Biaya Perusahaan", value: formatRupiah(run.employerCostTotal) },
    { label: "Jumlah Karyawan", value: run.employeeCount },
  ];

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Link className="btn btn-g" href="/payroll">
        Kembali
      </Link>
      <a
        className="btn btn-g"
        href={`/api/payroll/runs/${run.id}/export?format=xlsx`}
      >
        Ekspor XLSX
      </a>
      <a
        className="btn btn-g"
        href={`/api/payroll/runs/${run.id}/export?format=transfer`}
      >
        Daftar Transfer
      </a>
      {run.status === "Draft" && (
        <>
          <button
            type="button"
            className="btn btn-g"
            onClick={() => void runAction("recalculate", "Payroll dihitung ulang")}
            disabled={busy}
          >
            {busy ? "Memproses…" : "Hitung Ulang"}
          </button>
          <button
            type="button"
            className="btn btn-p"
            onClick={() => {
              setActionError("");
              setDialog("finalize");
            }}
            disabled={busy}
          >
            Final
          </button>
        </>
      )}
      {run.status === "Final" && (
        <button
          type="button"
          className="btn btn-p"
          onClick={() => {
            setActionError("");
            setDialog("paid");
          }}
          disabled={busy}
        >
          Tandai Dibayar
        </button>
      )}
      {(run.status === "Final" || run.status === "Dibayar") && (
        <button
          type="button"
          className="btn btn-g"
          onClick={() => {
            setActionError("");
            setDialog("revise");
          }}
          disabled={busy}
        >
          Revisi
        </button>
      )}
    </div>
  );

  return (
    <>
      <PageHead
        title={`Payroll ${formatMonthYearID(run.periodMonth)}`}
        subtitle={`Status ${run.status} · dibuat ${formatDateID(run.createdAt)}`}
      >
        {actions}
      </PageHead>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`tag ${payrollRunStatusTone(run.status)}`}>
          {run.status}
        </span>
        {run.revisionReason && (
          <span className="text-[11px] sub">
            Revisi: {run.revisionReason}
          </span>
        )}
        {run.paidDate && (
          <span className="text-[11px] sub">
            Dibayar {formatDateID(run.paidDate)}
          </span>
        )}
      </div>

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

      {actionError && (
        <div className="tag t-bad w-full justify-center mb-4">
          {actionError}
        </div>
      )}

      {run.warnings.length > 0 && (
        <div className="card p-4 mb-4 text-[12px]" style={{ background: "#FFF7E6", borderColor: "#E8D3B8", color: "#8A5A12" }}>
          <div className="flex flex-col gap-1">
            {run.warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="font-bold">Rincian Karyawan</div>
            <div className="text-[11px] sub">
              Baris yang belum Lengkap harus diperbaiki sebelum finalisasi.
            </div>
          </div>
          <div className="text-[11px] sub">
            {detail.employees.length} karyawan dihitung
          </div>
        </div>
        <DataTable
          ariaLabel="Rincian payroll karyawan"
          columns={columns}
          rows={detail.employees}
          rowKey={(employee) => employee.id}
          rowLabel={(employee) =>
            `Buka rincian payroll ${employee.employeeName}`
          }
          onRowActivate={(employee) => setSelectedId(employee.employeeId)}
          rowAction={{
            ariaLabel: (employee) =>
              `Buka rincian payroll ${employee.employeeName}`,
            label: "Buka rincian",
          }}
          empty="Belum ada snapshot karyawan. Jalankan Hitung Ulang."
          minWidth={1100}
        />
      </div>

      <PayrollRunEmployeeDrawer
        employee={selected}
        run={run}
        onClose={() => setSelectedId(null)}
        onMutated={(message) => {
          toast(message);
          void refresh().catch((error) =>
            toast(error instanceof Error ? error.message : "Gagal memuat run")
          );
        }}
      />

      {dialog === "finalize" && (
        <div className="rl">
          <ConfirmDialog
            title="Finalisasi payroll?"
            description="Setelah Final, run tidak bisa diedit selain melalui Revisi. Pastikan semua baris sudah lengkap."
            confirmLabel="Ya, finalisasi"
            busy={busy}
            error={actionError}
            danger
            onClose={() => setDialog(null)}
            onConfirm={() =>
              void runAction("finalize", "Payroll difinalisasi")
            }
          />
        </div>
      )}

      {dialog === "paid" && (
        <div className="rl">
          <ConfirmDialog
            title="Tandai payroll dibayar?"
            description="Tanggal bayar hari ini akan dicatat beserta aktor yang menandai."
            confirmLabel="Ya, tandai dibayar"
            busy={busy}
            error={actionError}
            onClose={() => setDialog(null)}
            onConfirm={() => void runAction("paid", "Payroll ditandai dibayar")}
          />
        </div>
      )}

      <PayrollReasonDialog
        open={dialog === "revise"}
        title="Revisi payroll?"
        description="Revisi membuat run Draft baru dan menandai run ini Direvisi. Alasan wajib diisi."
        label="Alasan revisi"
        confirmLabel="Buat revisi"
        busy={busy}
        error={actionError}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void revise(reason)}
      />
    </>
  );
}
