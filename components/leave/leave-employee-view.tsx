"use client";

import { useCallback, useState } from "react";
import { LeaveRequestDetailDrawer } from "@/components/leave/leave-request-detail-drawer";
import { LeaveRequestFormDrawer } from "@/components/leave/leave-request-form-drawer";
import { LeaveStatusTag } from "@/components/leave/leave-status-tag";
import { PageHead } from "@/components/page-head";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { useRecruitment } from "@/components/recruitment-provider";
import {
  DataTable,
  TwoLineCell,
  type DataTableColumn,
} from "@/components/ui/data-table";
import { formatDateID } from "@/lib/datetime";
import { leaveBalanceDisplay, leaveCategoryLabel } from "@/lib/leave/rules";
import type {
  LeaveEmployeeData,
  LeaveRequest,
} from "@/lib/leave/types";
import "@/components/recruitment-live/live.css";

export function LeaveEmployeeView({
  initialData,
}: {
  initialData: LeaveEmployeeData;
}) {
  const { toast } = useRecruitment();
  const [data, setData] = useState(initialData);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [loading, setLoading] = useState(false);

  const selected =
    data.requests.find((request) => request.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leave/me?year=${data.year}`, {
        cache: "no-store",
      });
      const body = (await response
        .json()
        .catch(() => null)) as (LeaveEmployeeData & { error?: string }) | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Gagal memuat cuti & izin");
      }
      setData(body);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Gagal memuat cuti & izin"
      );
    } finally {
      setLoading(false);
    }
  }, [data.year, toast]);

  const cancelOwn = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    setCancelError("");
    try {
      const response = await fetch(
        `/api/leave/requests/${cancelTarget.id}/cancel`,
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
      toast("Pengajuan cuti dibatalkan");
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

  const balance = data.balance;
  const balanceView = leaveBalanceDisplay(balance, data.todayIso);
  const canApply =
    Boolean(data.linked && data.employee) &&
    data.employee?.status !== "Nonaktif";

  const columns: DataTableColumn<LeaveRequest>[] = [
    {
      key: "type",
      label: "Jenis",
      width: "24%",
      render: (request) => (
        <TwoLineCell
          primary={request.leaveTypeName}
          secondary={leaveCategoryLabel(request.leaveTypeCategory)}
        />
      ),
    },
    {
      key: "dates",
      label: "Tanggal",
      width: "24%",
      render: (request) => (
        <TwoLineCell
          primary={formatDateID(request.startDate)}
          secondary={`s/d ${formatDateID(request.endDate)}`}
        />
      ),
    },
    {
      key: "days",
      label: "Hari",
      width: "10%",
      render: (request) => (
        <span className="text-[13px]">{request.daysCount} hari</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "18%",
      render: (request) => <LeaveStatusTag status={request.status} />,
    },
    {
      key: "actions",
      label: "Aksi",
      width: "24%",
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
        title="Cuti & Izin"
        subtitle="Ajukan cuti, pantau saldo, dan lihat status pengajuanmu."
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
            Akun kamu belum tertaut ke data karyawan, sehingga cuti & izin belum
            bisa digunakan. Hubungi admin HR untuk menautkan akunmu.
          </div>
        </div>
      ) : (
        <>
          <div className="card p-5 sm:p-6 mb-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="font-bold">Saldo Cuti Tahunan</div>
                <div className="text-[11px] sub">
                  Tahun kalender {data.year}. Saldo dihitung dari pengajuan yang
                  disetujui.
                </div>
              </div>
              <span
                className={`tag ${balanceView?.statusTone ?? "t-mute"}`}
              >
                {balanceView?.statusLabel ?? "Belum berhak"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Hak",
                  value: balanceView?.entitlement ?? 0,
                  hint: "hari kerja / tahun",
                },
                {
                  label: "Terpakai",
                  value: balanceView?.used ?? 0,
                  hint: "dari pengajuan disetujui",
                },
                {
                  label: "Sisa",
                  value: balanceView?.remaining ?? 0,
                  hint: "siap diajukan",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-3 rounded-xl"
                  style={{ background: "#FAF7F5" }}
                >
                  <div className="text-[11px] sub">{item.label}</div>
                  <div className="text-[24px] font-bold leading-tight">
                    {item.value}
                  </div>
                  <div className="text-[10px] sub">{item.hint}</div>
                </div>
              ))}
            </div>

            <div className="text-[12px] sub mt-3">
              {balanceView?.note ??
                "Saldo cuti tahunan belum bisa dimuat."}
            </div>
          </div>

          <div className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="font-bold">Pengajuan Saya</div>
                <div className="text-[11px] sub">
                  Detail pengajuan dibuka di panel samping.
                </div>
              </div>
              <div className="text-[11px] sub">
                {data.requests.length} pengajuan
              </div>
            </div>

            <DataTable
              ariaLabel="Daftar pengajuan cuti dan izin"
              columns={columns}
              rows={data.requests}
              rowKey={(request) => request.id}
              rowLabel={(request) =>
                `Buka detail ${request.leaveTypeName} ${request.startDate}`
              }
              onRowActivate={(request) => setSelectedId(request.id)}
              empty="Belum ada pengajuan cuti atau izin."
              minWidth={760}
            />
          </div>
        </>
      )}

      <LeaveRequestFormDrawer
        open={formOpen}
        data={data}
        onClose={() => setFormOpen(false)}
        onSaved={(message) => {
          setFormOpen(false);
          toast(message);
          void refresh();
        }}
      />

      <LeaveRequestDetailDrawer
        request={selected}
        mode="employee"
        balance={balance}
        todayIso={data.todayIso}
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
            title="Batalkan pengajuan?"
            description={`Pengajuan ${cancelTarget.leaveTypeName} pada ${formatDateID(
              cancelTarget.startDate
            )}–${formatDateID(cancelTarget.endDate)} akan ditarik dari antrean.`}
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
