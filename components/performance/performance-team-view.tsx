"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { PerformanceStatusTag } from "@/components/performance/performance-tags";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID } from "@/lib/datetime";
import { formatPerformanceScore } from "@/lib/performance/rules";
import type { PerformanceTeamRow } from "@/lib/performance/types";

export function PerformanceTeamView({
  initialRows,
  linked,
}: {
  initialRows: PerformanceTeamRow[];
  linked: boolean;
}) {
  const router = useRouter();
  const { toast } = useRecruitment();
  const [rows, setRows] = useState(initialRows);

  const stats = useMemo(() => {
    const count = (status: string) =>
      rows.filter((row) => row.status === status).length;
    return [
      { label: "Total Penugasan", value: rows.length },
      { label: "Draft", value: count("Draft") },
      { label: "Dikirim", value: count("Dikirim") },
      { label: "Dikembalikan", value: count("Dikembalikan") },
    ];
  }, [rows]);

  const refresh = async () => {
    const response = await fetch("/api/performance/team", { cache: "no-store" });
    const body = (await response.json().catch(() => null)) as {
      rows?: PerformanceTeamRow[];
      error?: string;
    } | null;
    if (!response.ok || !body?.rows) {
      throw new Error(body?.error ?? "Gagal memuat penilaian tim");
    }
    setRows(body.rows);
  };

  const columns: DataTableColumn<PerformanceTeamRow>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "26%",
      render: (row) => (
        <TwoLineCell
          primary={row.employeeName}
          secondary={`${row.department} · ${row.employeeId}`}
        />
      ),
    },
    {
      key: "period",
      label: "Periode",
      width: "24%",
      render: (row) => (
        <TwoLineCell
          primary={row.periodName}
          secondary={`Batas ${formatDateID(row.periodDueDate)}`}
        />
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "16%",
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <PerformanceStatusTag status={row.status} />
          {row.status === "Dikembalikan" && row.returnReason && (
            <span className="text-[10px] sub">{row.returnReason}</span>
          )}
        </div>
      ),
    },
    {
      key: "score",
      label: "Skor",
      width: "12%",
      render: (row) => (
        <span className="text-[13px]">
          {formatPerformanceScore(row.finalScore)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Aksi",
      width: "14%",
      render: (row) => (
        <button
          type="button"
          className="btn btn-g !py-1 !px-2 !text-[11px]"
          onClick={(event) => {
            event.stopPropagation();
            router.push(`/performance/tim/${row.id}`);
          }}
        >
          {row.status === "Draft" || row.status === "Dikembalikan"
            ? "Isi"
            : "Lihat"}
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title="Penilaian Tim"
        subtitle="Lembar bawahan yang ditugaskan kepada Anda pada periode Terbuka."
      >
        <button
          type="button"
          className="btn btn-g"
          onClick={() =>
            void refresh().catch((err) =>
              toast(err instanceof Error ? err.message : "Gagal memuat penugasan")
            )
          }
        >
          Muat ulang
        </button>
      </PageHead>

      {!linked ? (
        <div className="card p-8 text-center max-w-[680px]">
          <div className="font-semibold text-[15px]">
            Akun ini tidak tertaut ke data karyawan
          </div>
          <div className="sub text-[13px] mt-2">
            Penugasan penilai memakai Employee ID. HR dan Admin tetap dapat
            mengisi lembar sebagai penilai pengganti dari detail periode.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            {stats.map((card) => (
              <div className="card p-4" key={card.label}>
                <div className="text-[11px] sub font-semibold">
                  {card.label}
                </div>
                <div className="text-[20px] font-bold tracking-tight mt-1">
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          <div className="card p-5 sm:p-6">
            <div className="font-bold mb-1">Daftar Bawahan</div>
            <div className="text-[11px] sub mb-4">
              Anda hanya dapat melihat lembar yang ditugaskan kepada Anda.
            </div>
            <DataTable
              ariaLabel="Daftar penilaian tim"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              rowLabel={(row) => `Buka penilaian ${row.employeeName}`}
              onRowActivate={(row) =>
                router.push(`/performance/tim/${row.id}`)
              }
              rowAction={{
                ariaLabel: (row) => `Buka penilaian ${row.employeeName}`,
                label: "Buka penilaian",
              }}
              empty="Belum ada penugasan penilaian pada periode Terbuka."
              minWidth={820}
            />
          </div>
        </>
      )}
    </>
  );
}
