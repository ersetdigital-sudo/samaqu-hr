"use client";

import { useCallback, useState } from "react";
import { PayrollProfileDrawer } from "@/components/payroll/payroll-profile-drawer";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID } from "@/lib/datetime";
import { formatRupiah } from "@/lib/payroll/rules";
import type { PayrollProfileRecord } from "@/lib/payroll/types";

export function PayrollProfilesView({
  initialProfiles,
  todayIso,
}: {
  initialProfiles: PayrollProfileRecord[];
  todayIso: string;
}) {
  const { toast } = useRecruitment();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected =
    profiles.find((record) => record.employee.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/payroll/profiles", {
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as {
        profiles?: PayrollProfileRecord[];
        error?: string;
      } | null;
      if (!response.ok || !body?.profiles) {
        throw new Error(body?.error ?? "Gagal memuat profil payroll");
      }
      setProfiles(body.profiles);
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Gagal memuat profil payroll"
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const completeCount = profiles.filter(
    (record) => record.issues.length === 0
  ).length;

  const columns: DataTableColumn<PayrollProfileRecord>[] = [
    {
      key: "employee",
      label: "Karyawan",
      width: "28%",
      render: (record) => (
        <TwoLineCell
          primary={record.employee.fullName}
          secondary={`${record.employee.department} · ${record.employee.id}`}
        />
      ),
    },
    {
      key: "ptkp",
      label: "PTKP",
      width: "10%",
      render: (record) => (
        <span className="text-[13px]">{record.profile?.ptkpStatus ?? "—"}</span>
      ),
    },
    {
      key: "salary",
      label: "Gaji Pokok",
      width: "18%",
      render: (record) => (
        <span className="text-[13px]">
          {record.profile ? formatRupiah(record.profile.baseSalary) : "—"}
        </span>
      ),
    },
    {
      key: "allowance",
      label: "Tunjangan Tetap",
      width: "16%",
      render: (record) => (
        <span className="text-[13px]">
          {record.profile ? formatRupiah(record.profile.fixedAllowance) : "—"}
        </span>
      ),
    },
    {
      key: "effective",
      label: "Berlaku",
      width: "12%",
      render: (record) => (
        <span className="text-[12px]">
          {record.profile ? formatDateID(record.profile.effectiveDate) : "—"}
        </span>
      ),
    },
    {
      key: "completeness",
      label: "Kelengkapan",
      width: "16%",
      render: (record) =>
        record.issues.length === 0 ? (
          <span className="tag t-ok">Lengkap</span>
        ) : (
          <span className="flex flex-col items-start gap-1">
            {record.issues.slice(0, 2).map((issue) => (
              <span className="tag t-warn" key={issue}>
                {issue}
              </span>
            ))}
            {record.issues.length > 2 && (
              <span className="text-[10px] sub">
                +{record.issues.length - 2} lainnya
              </span>
            )}
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHead
        title="Profil Gaji"
        subtitle="Gaji pokok, tunjangan, PTKP, BPJS, dan rekening payroll. Data sensitif hanya untuk staf payroll."
      >
        <button
          type="button"
          className="btn btn-g"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "Memuat…" : "Muat ulang"}
        </button>
      </PageHead>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="text-[12px] sub">
          {completeCount} dari {profiles.length} profil lengkap.
        </div>
        <div className="text-[12px] sub">
          NPWP boleh kosong, tetapi akan ditandai saat payroll.
        </div>
      </div>

      <DataTable
        ariaLabel="Daftar profil gaji karyawan"
        columns={columns}
        rows={profiles}
        rowKey={(record) => record.employee.id}
        rowLabel={(record) => `Buka profil gaji ${record.employee.fullName}`}
        onRowActivate={(record) => setSelectedId(record.employee.id)}
        rowAction={{
          ariaLabel: (record) =>
            `Buka profil gaji ${record.employee.fullName}`,
          label: "Buka profil",
        }}
        empty="Belum ada karyawan."
        minWidth={900}
      />

      <PayrollProfileDrawer
        record={selected}
        open={Boolean(selected)}
        todayIso={todayIso}
        onClose={() => setSelectedId(null)}
        onSaved={(message) => {
          toast(message);
          void refresh();
        }}
      />
    </>
  );
}
