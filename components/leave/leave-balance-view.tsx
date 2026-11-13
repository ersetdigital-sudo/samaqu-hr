"use client";

import { useCallback, useMemo, useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID } from "@/lib/datetime";
import { leaveBalanceDisplay } from "@/lib/leave/rules";
import type {
  LeaveBalance,
  LeaveBalanceData,
} from "@/lib/leave/types";

export function LeaveBalanceView({
  initialData,
}: {
  initialData: LeaveBalanceData;
}) {
  const { toast } = useRecruitment();
  const [data, setData] = useState(initialData);
  const [year, setYear] = useState(initialData.year);
  const [loading, setLoading] = useState(false);

  const currentYear = Number(initialData.todayIso.slice(0, 4));
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const stats = useMemo(() => {
    const eligible = data.balances.filter((balance) => balance.eligible);
    return {
      total: data.balances.length,
      eligible: eligible.length,
      used: data.balances.reduce((sum, balance) => sum + balance.used, 0),
      remaining: eligible.reduce(
        (sum, balance) => sum + balance.remaining,
        0
      ),
    };
  }, [data.balances]);

  const load = useCallback(
    async (nextYear: number) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/leave/balances?year=${nextYear}`,
          { cache: "no-store" }
        );
        const body = (await response
          .json()
          .catch(() => null)) as (LeaveBalanceData & { error?: string }) | null;
        if (!response.ok || !body) {
          throw new Error(body?.error ?? "Gagal memuat saldo cuti");
        }
        setData(body);
        setYear(nextYear);
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Gagal memuat saldo cuti"
        );
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const columns: DataTableColumn<LeaveBalance>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "37%",
      render: (balance) => (
        <TwoLineCell
          primary={balance.fullName}
          secondary={`${balance.department} · ${balance.employeeId} · bergabung ${formatDateID(
            balance.joinedAt
          )}`}
        />
      ),
    },
    {
      key: "entitlement",
      label: "Hak",
      width: "13%",
      render: (balance) => {
        const view = leaveBalanceDisplay(balance, data.todayIso);
        return (
          <span className="text-[13px]">{view?.entitlement ?? 0} hari</span>
        );
      },
    },
    {
      key: "used",
      label: "Terpakai",
      width: "12%",
      render: (balance) => (
        <span className="text-[13px]">{balance.used} hari</span>
      ),
    },
    {
      key: "remaining",
      label: "Sisa",
      width: "12%",
      render: (balance) => {
        const view = leaveBalanceDisplay(balance, data.todayIso);
        return (
          <b className="text-[13px]">{view?.remaining ?? 0} hari</b>
        );
      },
    },
    {
      key: "status",
      label: "Status Hak",
      width: "16%",
      render: (balance) => {
        const view = leaveBalanceDisplay(balance, data.todayIso);
        if (!view) return <span className="sub text-[12px]">—</span>;
        return (
          <span className="flex flex-col items-start gap-1">
            <span className={`tag ${view.statusTone}`}>{view.statusLabel}</span>
            {view.activeDateLabel && (
              <span className="text-[10px] sub">
                aktif {view.activeDateLabel}
              </span>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHead
        title="Saldo Cuti"
        subtitle="Saldo cuti tahunan seluruh karyawan, dihitung dari pengajuan yang disetujui."
      >
        <select
          className="inp !w-auto"
          value={year}
          disabled={loading}
          onChange={(event) => void load(Number(event.target.value))}
          aria-label="Pilih tahun saldo cuti"
        >
          {yearOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-g"
          onClick={() => void load(year)}
          disabled={loading}
        >
          {loading ? "Memuat…" : "Muat ulang"}
        </button>
      </PageHead>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {[
          { label: "Total Karyawan", value: stats.total, hint: "di direktori" },
          {
            label: "Hak Aktif",
            value: stats.eligible,
            hint: "sudah 12 bulan & Aktif",
          },
          {
            label: "Terpakai",
            value: `${stats.used} hari`,
            hint: `tahun ${data.year}`,
          },
          {
            label: "Total Sisa",
            value: `${stats.remaining} hari`,
            hint: "dari karyawan yang berhak",
          },
        ].map((card) => (
          <div className="card p-4" key={card.label}>
            <div className="text-[11px] sub font-semibold">{card.label}</div>
            <div className="text-[24px] font-bold tracking-tight mt-1">
              {card.value}
            </div>
            <div className="text-[10px] sub">{card.hint}</div>
          </div>
        ))}
      </div>

      <DataTable
        ariaLabel="Saldo cuti tahunan karyawan"
        columns={columns}
        rows={data.balances}
        rowKey={(balance) => balance.employeeId}
        empty="Belum ada data saldo cuti."
        minWidth={840}
      />
    </>
  );
}
