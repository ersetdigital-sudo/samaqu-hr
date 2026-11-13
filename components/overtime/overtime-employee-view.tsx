"use client";

import { useCallback, useState } from "react";
import { OvertimeDetailDrawer } from "@/components/overtime/overtime-detail-drawer";
import { OvertimeFormDrawer } from "@/components/overtime/overtime-form-drawer";
import { OvertimeDayTag, OvertimeStatusTag } from "@/components/overtime/overtime-tags";
import { PageHead } from "@/components/page-head";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID } from "@/lib/datetime";
import {
  overtimeDayTypeLabel,
  overtimeHoursLabel,
} from "@/lib/overtime/rules";
import type {
  OvertimeEmployeeData,
  OvertimeRequest,
} from "@/lib/overtime/types";
import "@/components/recruitment-live/live.css";

export function OvertimeEmployeeView({
  initialData,
}: {
  initialData: OvertimeEmployeeData;
}) {
  const { toast } = useRecruitment();
  const [data, setData] = useState(initialData);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OvertimeRequest | null>(
    null
  );
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [loading, setLoading] = useState(false);

  const selected =
    data.requests.find((request) => request.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/overtime/me", {
        cache: "no-store",
      });
      const body = (await response
        .json()
        .catch(() => null)) as (OvertimeEmployeeData & { error?: string }) | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Gagal memuat lembur");
      }
      setData(body);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gagal memuat lembur");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const cancelOwn = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    setCancelError("");
    try {
      const response = await fetch(
        `/api/overtime/requests/${cancelTarget.id}/cancel`,
        { method: "POST" }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal membatalkan pengajuan");
      }
      setCancelTarget(null);
      setSelectedId(null);
      toast("Pengajuan lembur dibatalkan");
      await refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal membatalkan pengajuan";
      setCancelError(message);
      toast(message);
    } finally {
      setCancelling(false);
    }
  };

  const canApply =
    Boolean(data.linked && data.employee) &&
    data.employee?.status !== "Nonaktif";

  const columns: DataTableColumn<OvertimeRequest>[] = [
    {
      key: "date",
      label: "Tanggal",
      width: "16%",
      render: (request) => (
        <span className="text-[13px]">{formatDateID(request.requestDate)}</span>
      ),
    },
    {
      key: "time",
      label: "Jam",
      width: "16%",
      render: (request) => (
        <TwoLineCell
          primary={`${request.startTime}–${request.endTime}`}
          secondary={`Diajukan ${overtimeHoursLabel(
            request.requestedMinutes
          )}`}
        />
      ),
    },
    {
      key: "day",
      label: "Jenis Hari",
      width: "20%",
      render: (request) => <OvertimeDayTag dayType={request.dayType} />,
    },
    {
      key: "approved",
      label: "Disetujui",
      width: "16%",
      render: (request) => (
        <TwoLineCell
          primary={overtimeHoursLabel(request.approvedMinutes)}
          secondary={
            request.equivalentMinutes !== null
              ? `${overtimeHoursLabel(request.equivalentMinutes)} ekuivalen`
              : overtimeDayTypeLabel(request.dayType)
          }
        />
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "14%",
      render: (request) => <OvertimeStatusTag status={request.status} />,
    },
    {
      key: "actions",
      label: "Aksi",
      width: "18%",
      render: (request) => (
        <span className="flex flex-wrap gap-1">
          <button
            type="button"
            className="btn btn-g !py-1 !px-2 !text-[11px]"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedId(request.id);
            }}
          >
            Detail
          </button>
          {request.status === "Menunggu" && (
            <button
              type="button"
              className="btn btn-g !py-1 !px-2 !text-[11px]"
              style={{ color: "var(--bad)" }}
              onClick={(event) => {
                event.stopPropagation();
                setCancelError("");
                setCancelTarget(request);
              }}
            >
              Batalkan
            </button>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title="Lembur"
        subtitle="Ajukan lembur, pantau jam disetujui, dan lihat ekuivalensinya."
      >
        <button
          type="button"
          className="btn btn-g"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "Memuat…" : "Muat ulang"}
        </button>
        <button
          type="button"
          className="btn btn-p"
          onClick={() => setFormOpen(true)}
          disabled={!canApply}
        >
          Ajukan
        </button>
      </PageHead>

      {!data.linked || !data.employee ? (
        <div className="card p-8 text-center max-w-[640px]">
          <div className="font-semibold text-[15px]">Akun belum tertaut</div>
          <div className="sub text-[13px] mt-2">
            Akun kamu belum tertaut ke data karyawan, sehingga lembur belum bisa
            digunakan. Hubungi admin HR untuk menautkan akunmu.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {[
              {
                label: "Jam Disetujui",
                value: overtimeHoursLabel(data.monthlyApprovedMinutes),
                hint: "bulan ini",
              },
              {
                label: "Jam Ekuivalen",
                value: overtimeHoursLabel(data.monthlyEquivalentMinutes),
                hint: "bulan ini",
              },
              {
                label: "Sisa Batas Minggu",
                value: overtimeHoursLabel(data.weeklyRemainingMinutes),
                hint: `${formatDateID(data.weekStart)}–${formatDateID(
                  data.weekEnd
                )}`,
              },
            ].map((item) => (
              <div className="card p-4" key={item.label}>
                <div className="text-[11px] sub font-semibold">
                  {item.label}
                </div>
                <div className="text-[24px] font-bold tracking-tight mt-1">
                  {item.value}
                </div>
                <div className="text-[10px] sub">{item.hint}</div>
              </div>
            ))}
          </div>

          <div className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="font-bold">Pengajuan Lembur</div>
                <div className="text-[11px] sub">
                  Maksimal 4 jam/hari dan 18 jam/minggu. Lembur lintas tengah
                  malam belum didukung.
                </div>
              </div>
              <div className="text-[11px] sub">
                {data.requests.length} pengajuan
              </div>
            </div>

            <DataTable
              ariaLabel="Daftar pengajuan lembur"
              columns={columns}
              rows={data.requests}
              rowKey={(request) => request.id}
              rowLabel={(request) =>
                `Buka detail lembur ${formatDateID(request.requestDate)}`
              }
              onRowActivate={(request) => setSelectedId(request.id)}
              rowAction={{
                ariaLabel: (request) =>
                  `Lihat detail lembur ${formatDateID(request.requestDate)}`,
                label: "Lihat detail",
              }}
              empty="Belum ada pengajuan lembur."
              minWidth={760}
            />
          </div>
        </>
      )}

      <OvertimeFormDrawer
        open={formOpen}
        data={data}
        onClose={() => setFormOpen(false)}
        onSaved={(message) => {
          setFormOpen(false);
          toast(message);
          void refresh();
        }}
      />

      <OvertimeDetailDrawer
        request={selected}
        mode="employee"
        onClose={() => setSelectedId(null)}
        onMutated={(message) => {
          setSelectedId(null);
          toast(message);
          void refresh();
        }}
      />

      {cancelTarget && (
        <div className="rl">
          <ConfirmDialog
            title="Batalkan pengajuan lembur?"
            description={`Pengajuan ${formatDateID(
              cancelTarget.requestDate
            )} pukul ${cancelTarget.startTime}–${cancelTarget.endTime} akan ditarik dari antrean.`}
            confirmLabel="Ya, batalkan"
            busy={cancelling}
            error={cancelError}
            danger
            onClose={() => setCancelTarget(null)}
            onConfirm={() => void cancelOwn()}
          />
        </div>
      )}
    </>
  );
}
