"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { LeaveActionDialog } from "@/components/leave/leave-action-dialog";
import { LeaveStatusTag } from "@/components/leave/leave-status-tag";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoGrid, InfoItem } from "@/components/ui/detail-info";
import { FormSection } from "@/components/ui/form-section";
import { formatDateID, formatDateTimeID } from "@/lib/datetime";
import { formatFileSize } from "@/lib/documents/query";
import { ini } from "@/lib/data";
import type {
  LeaveBalance,
  LeaveCalendarEntry,
  LeaveRequest,
} from "@/lib/leave/types";
import "@/components/recruitment-live/live.css";

type DialogKind = "approve" | "reject" | "hr-cancel" | "own-cancel" | null;

export function LeaveRequestDetailDrawer({
  request,
  mode,
  balance,
  teamOverlaps = [],
  onClose,
  onMutated,
}: {
  request: LeaveRequest | null;
  mode: "employee" | "staff";
  balance: LeaveBalance | null;
  teamOverlaps?: LeaveCalendarEntry[];
  onClose: () => void;
  onMutated: (message: string) => void;
}) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setDialog(null);
    setBusy(false);
    setActionError("");
  }, [request?.id]);

  const runDecision = async (decision: "Disetujui" | "Ditolak", reason: string) => {
    if (!request || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(
        `/api/leave/requests/${request.id}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, reason }),
        }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal memproses keputusan");
      }
      setDialog(null);
      onMutated(
        decision === "Disetujui"
          ? "Pengajuan cuti disetujui"
          : "Pengajuan cuti ditolak"
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Gagal memproses keputusan"
      );
    } finally {
      setBusy(false);
    }
  };

  const runHrCancel = async (reason: string) => {
    if (!request || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(
        `/api/leave/requests/${request.id}/cancel-approved`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal membatalkan cuti");
      }
      setDialog(null);
      onMutated("Cuti yang disetujui dibatalkan HR");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Gagal membatalkan cuti"
      );
    } finally {
      setBusy(false);
    }
  };

  const runOwnCancel = async () => {
    if (!request || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(
        `/api/leave/requests/${request.id}/cancel`,
        { method: "POST" }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal membatalkan pengajuan");
      }
      setDialog(null);
      onMutated("Pengajuan cuti dibatalkan");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Gagal membatalkan pengajuan"
      );
    } finally {
      setBusy(false);
    }
  };

  const footer =
    request && mode === "employee" && request.status === "Menunggu" ? (
      <button
        type="button"
        className="btn btn-d"
        onClick={() => setDialog("own-cancel")}
        disabled={busy}
      >
        Batalkan Pengajuan
      </button>
    ) : request && mode === "staff" && request.status === "Menunggu" ? (
      <>
        <button
          type="button"
          className="btn btn-p"
          onClick={() => setDialog("approve")}
          disabled={busy}
        >
          Setujui
        </button>
        <button
          type="button"
          className="btn btn-d"
          onClick={() => setDialog("reject")}
          disabled={busy}
        >
          Tolak
        </button>
      </>
    ) : request && mode === "staff" && request.status === "Disetujui" ? (
      <button
        type="button"
        className="btn btn-d"
        onClick={() => setDialog("hr-cancel")}
        disabled={busy}
      >
        Batalkan oleh HR
      </button>
    ) : undefined;

  return (
    <>
      <DetailDrawer
        open={Boolean(request)}
        title="Detail Pengajuan Cuti"
        description={
          request
            ? `${request.leaveTypeName} · ${formatDateID(request.startDate)}–${formatDateID(request.endDate)}`
            : undefined
        }
        size="md"
        onClose={onClose}
        footer={footer}
      >
        {request && (
          <div className="flex flex-col gap-4">
            {actionError && (
              <div className="tag t-bad w-full justify-center text-center whitespace-normal py-2">
                {actionError}
              </div>
            )}

            <FormSection
              icon="users"
              title={mode === "staff" ? "Karyawan" : "Pemohon"}
              description="Identitas karyawan dan status pengajuan."
            >
              <div className="flex items-center gap-4">
                <div
                  className="av"
                  style={{ width: 56, height: 56, fontSize: 18 }}
                >
                  {ini(request.employeeName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[17px] leading-tight break-words">
                    {request.employeeName}
                  </div>
                  <div className="sub text-[12px]">
                    {request.employeeId} · {request.employeePosition}
                  </div>
                  <div className="sub text-[11px]">
                    {request.employeeDepartment}
                  </div>
                  <div className="mt-2">
                    <LeaveStatusTag status={request.status} />
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection
              icon="cal"
              title="Pengajuan"
              description="Rincian tanggal, alasan, dan lampiran."
            >
              <InfoGrid>
                <InfoItem label="Jenis" value={request.leaveTypeName} />
                <InfoItem label="Jumlah" value={`${request.daysCount} hari`} />
                <InfoItem
                  label="Mulai"
                  value={formatDateID(request.startDate)}
                />
                <InfoItem
                  label="Selesai"
                  value={formatDateID(request.endDate)}
                />
                <InfoItem
                  label="Diajukan"
                  value={formatDateTimeID(request.submittedAt)}
                  full
                />
                <InfoItem
                  label="Alasan"
                  value={request.reason ?? "—"}
                  full
                />
                {request.eventNote && (
                  <InfoItem
                    label="Keterangan kejadian"
                    value={request.eventNote}
                    full
                  />
                )}
              </InfoGrid>

              {request.attachment ? (
                <div
                  className="mt-3 p-3 rounded-xl flex flex-wrap items-center gap-3"
                  style={{ background: "#FAF7F5" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold break-words">
                      {request.attachment.fileName}
                    </div>
                    <div className="text-[11px] sub">
                      {formatFileSize(request.attachment.fileSize)}
                    </div>
                  </div>
                  <a
                    className="btn btn-g !py-1.5 !px-3"
                    href={`/api/leave/requests/${request.id}/attachment`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lihat Lampiran
                  </a>
                </div>
              ) : (
                <div className="text-[11px] sub mt-2">
                  Tidak ada lampiran pada pengajuan ini.
                </div>
              )}

              {request.decisionNote && request.status === "Ditolak" && (
                <div
                  className="mt-3 p-3 rounded-xl text-[12px]"
                  style={{ background: "#FDF0F0", color: "var(--bad)" }}
                >
                  <b>Alasan penolakan:</b> {request.decisionNote}
                </div>
              )}

              {request.cancellationReason && (
                <div
                  className="mt-3 p-3 rounded-xl text-[12px]"
                  style={{ background: "#FAF7F5" }}
                >
                  <b>Alasan pembatalan {request.cancellationKind}:</b>{" "}
                  {request.cancellationReason}
                </div>
              )}
            </FormSection>

            <FormSection
              icon="clock"
              title="Saldo Cuti Tahunan"
              description="Saldo dihitung dari pengajuan yang disetujui."
            >
              {balance ? (
                <InfoGrid>
                  <InfoItem
                    label="Hak tahunan"
                    value={`${balance.entitlement} hari`}
                  />
                  <InfoItem
                    label="Terpakai"
                    value={`${balance.used} hari`}
                  />
                  <InfoItem
                    label="Sisa"
                    value={`${balance.remaining} hari`}
                  />
                  <InfoItem
                    label="Status hak"
                    value={
                      balance.eligible
                        ? "Hak aktif"
                        : `Belum berhak · aktif ${formatDateID(
                            balance.eligibleDate
                          )}`
                    }
                    full
                  />
                </InfoGrid>
              ) : (
                <div className="text-[12px] sub">
                  Saldo cuti tahunan tidak tersedia untuk karyawan ini.
                </div>
              )}
            </FormSection>

            {mode === "staff" && (
              <FormSection
                icon="users"
                title="Tumpang Tindih Tim"
                description="Rekan satu departemen yang cuti pada rentang tanggal yang sama."
              >
                {teamOverlaps.length === 0 ? (
                  <div className="text-[12px] sub">
                    Tidak ada rekan satu departemen yang cuti pada rentang ini.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {teamOverlaps.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl"
                        style={{ background: "#FAF7F5" }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold break-words">
                              {entry.employeeName}
                            </div>
                            <div className="text-[11px] sub">
                              {entry.leaveTypeName} ·{" "}
                              {formatDateID(entry.startDate)}–
                              {formatDateID(entry.endDate)} ·{" "}
                              {entry.daysCount} hari
                            </div>
                          </div>
                          <LeaveStatusTag status={entry.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </FormSection>
            )}

            <FormSection
              icon="pipe"
              title="Riwayat Keputusan"
              description="Siapa memutuskan dan kapan."
            >
              {request.history.length === 0 ? (
                <div className="text-[12px] sub">
                  Belum ada riwayat keputusan.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {request.history.map((entry) => (
                    <div className="flex gap-3" key={entry.id}>
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: "var(--pink)" }}
                      />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">
                          {entry.action}
                        </div>
                        <div className="text-[11px] sub">
                          {formatDateTimeID(entry.actedAt)} · {entry.actorName}
                        </div>
                        {entry.reason && (
                          <div className="text-[11px] sub">
                            “{entry.reason}”
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </FormSection>
          </div>
        )}
      </DetailDrawer>

      <LeaveActionDialog
        open={dialog === "reject"}
        title="Tolak pengajuan?"
        description={`Pengajuan ${request?.employeeName ?? "karyawan"} akan ditolak dan alasan terlihat oleh karyawan.`}
        label="Alasan penolakan"
        placeholder="cth. tumpang tindih dengan jadwal tim"
        confirmLabel="Tolak pengajuan"
        danger
        busy={busy}
        error={actionError}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void runDecision("Ditolak", reason)}
      />

      <LeaveActionDialog
        open={dialog === "hr-cancel"}
        title="Batalkan cuti disetujui?"
        description="Saldo akan otomatis kembali setelah pembatalan. Tindakan ini tercatat di riwayat."
        label="Alasan pembatalan"
        placeholder="cth. kebutuhan operasional"
        confirmLabel="Batalkan cuti"
        danger
        busy={busy}
        error={actionError}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void runHrCancel(reason)}
      />

      {dialog === "approve" && request && (
        <div className="rl">
          <ConfirmDialog
            title="Setujui pengajuan?"
            description={`Setujui ${request.leaveTypeName} ${request.employeeName} pada ${formatDateID(
              request.startDate
            )}–${formatDateID(request.endDate)} (${request.daysCount} hari)?`}
            confirmLabel="Ya, setujui"
            busy={busy}
            error={actionError}
            onClose={() => setDialog(null)}
            onConfirm={() => void runDecision("Disetujui", "")}
          />
        </div>
      )}

      {dialog === "own-cancel" && request && (
        <div className="rl">
          <ConfirmDialog
            title="Batalkan pengajuan?"
            description={`Pengajuan ${request.leaveTypeName} pada ${formatDateID(
              request.startDate
            )}–${formatDateID(request.endDate)} akan ditarik dari antrean.`}
            confirmLabel="Ya, batalkan"
            busy={busy}
            error={actionError}
            danger
            onClose={() => setDialog(null)}
            onConfirm={() => void runOwnCancel()}
          />
        </div>
      )}
    </>
  );
}
