"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateTimeID } from "@/lib/datetime";
import type { ReportExportLogEntry } from "@/lib/reports/types";

export function ReportsExportHistoryView({
  initialLogs,
}: {
  initialLogs: ReportExportLogEntry[];
}) {
  const { toast } = useRecruitment();
  const [logs, setLogs] = useState(initialLogs);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (nextFrom: string, nextTo: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (nextFrom) params.set("from", nextFrom);
        if (nextTo) params.set("to", nextTo);
        const response = await fetch(`/api/reports/exports?${params}`, {
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as {
          logs?: ReportExportLogEntry[];
          error?: string;
        } | null;
        if (!response.ok || !body?.logs) {
          throw new Error(body?.error ?? "Gagal memuat riwayat ekspor");
        }
        setLogs(body.logs);
      } catch (error) {
        toast(
          error instanceof Error
            ? error.message
            : "Gagal memuat riwayat ekspor"
        );
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const rows = useMemo(() => {
    const query = q.trim().toLocaleLowerCase("id-ID");
    if (!query) return logs;
    return logs.filter((row) =>
      `${row.reportLabel} ${row.reportType} ${row.filterSummary} ${row.exportedByName}`
        .toLocaleLowerCase("id-ID")
        .includes(query)
    );
  }, [logs, q]);

  const columns: DataTableColumn<ReportExportLogEntry>[] = [
    {
      key: "time",
      label: "Waktu",
      width: "18%",
      render: (row) => (
        <span className="text-[13px]">{formatDateTimeID(row.createdAt)}</span>
      ),
    },
    {
      key: "user",
      label: "Pengguna",
      width: "18%",
      render: (row) => <span className="text-[13px]">{row.exportedByName}</span>,
    },
    {
      key: "report",
      label: "Laporan",
      width: "28%",
      render: (row) => (
        <TwoLineCell primary={row.reportLabel} secondary={row.filterSummary} />
      ),
    },
    {
      key: "rows",
      label: "Baris",
      width: "10%",
      render: (row) => <span className="text-[13px]">{row.rowCount}</span>,
    },
  ];

  return (
    <>
      <PageHead
        title="Riwayat Ekspor"
        subtitle="Audit ekspor laporan: waktu, pengguna, filter, dan jumlah baris."
      >
        <Link className="btn btn-g" href="/reports">
          Kembali
        </Link>
      </PageHead>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label>
          <span className="lbl">Cari</span>
          <input
            className="inp !w-64"
            placeholder="Laporan, pengguna, filter"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </label>
        <label>
          <span className="lbl">Dari tanggal</span>
          <input
            type="date"
            className="inp !w-auto"
            value={from}
            disabled={loading}
            onChange={(event) => {
              setFrom(event.target.value);
              void load(event.target.value, to);
            }}
          />
        </label>
        <label>
          <span className="lbl">Sampai tanggal</span>
          <input
            type="date"
            className="inp !w-auto"
            value={to}
            disabled={loading}
            onChange={(event) => {
              setTo(event.target.value);
              void load(from, event.target.value);
            }}
          />
        </label>
        <span className="text-[11px] sub pb-2">
          {loading ? "Memuat…" : `${rows.length} catatan ditampilkan`}
        </span>
      </div>

      <div className="card p-5">
        <DataTable
          ariaLabel="Riwayat ekspor laporan"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty="Belum ada riwayat ekspor yang cocok dengan filter."
          minWidth={760}
        />
      </div>
    </>
  );
}
