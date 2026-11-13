"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/recruitment-live/ui";
import { OvertimeDecisionDialog, type OvertimeDecisionMode } from "@/components/overtime/overtime-decision-dialog";
import { OvertimeDayTag, OvertimeStatusTag } from "@/components/overtime/overtime-tags";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoGrid, InfoItem } from "@/components/ui/detail-info";
import { FormSection } from "@/components/ui/form-section";
import { ini } from "@/lib/data";
import { formatDateID, formatDateTimeID } from "@/lib/datetime";
import {
  overtimeFormulaLabel,
  overtimeHoursLabel,
  overtimeUsageMinutes,
  overtimeWeekRange,
} from "@/lib/overtime/rules";
import type { OvertimeRequest } from "@/lib/overtime/types";
import "@/components/recruitment-live/live.css";

type DialogKind = "approve" | "reject" | "hr-cancel" | "own-cancel" | null;

export function OvertimeDetailDrawer({
  request,
  mode,
  activeRequests = [],
  onClose,
  onMutated,
}: {
  request: OvertimeRequest | null;
  mode: "employee" | "staff";
  activeRequests?: OvertimeRequest[];
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

  const runDecision = async (
    decision: "Disetujui" | "Ditolak",
    approvedMinutes: number | null,
    reason: string
  ) => {
    if (!request || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(
        `/api/overtime/requests/${request.id}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, approvedMinutes, reason }),
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
          ? "Pengajuan lembur disetujui"
          : "Pengajuan lembur ditolak"
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
        `/api/overtime/requests/${request.id}/cancel-approved`,
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
        throw new Error(body?.error ?? "Gagal membatalkan lembur");
      }
      setDialog(null);
      onMutated("Lembur disetujui dibatalkan HR");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Gagal membatalkan lembur"
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
        `/api/overtime/requests/${request.id}/cancel`,
        { method: "POST" }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal membatalkan pengajuan");
      }
      setDialog(null);
      onMutated("Pengajuan lembur dibatalkan");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Gagal membatalkan pengajuan"
      );
    } finally {
      setBusy(false);
    }
  };

  const week = request ? overtimeWeekRange(request.requestDate) : null;
  const employeeWeek = request
    ? activeRequests.filter(
        (item) =>
          item.employeeId === request.employeeId &&
          item.requestDate >= (week?.start ?? "") &&
          item.requestDate <= (week?.end ?? "")
      )
    : [];
  const weekApprovedMinutes = employeeWeek
    .filter((item) => item.status === "Disetujui")
    .reduce((sum, item) => sum + (item.approvedMinutes ?? 0), 0);
  const weekEquivalentMinutes = employeeWeek
    .filter((item) => item.status === "Disetujui")
    .reduce((sum, item) => sum + (item.equivalentMinutes ?? 0), 0);
  const weekPendingMinutes = employeeWeek
    .filter((item) => item.status === "Menunggu")
    .reduce((sum, item) => sum + overtimeUsageMinutes(item), 0);

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
        title="Detail Lembur"
        description={
          request
            ? `${formatDateID(request.requestDate)} · ${request.startTime}–${request.endTime}`
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
                    <OvertimeStatusTag status={request.status} />
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection
              icon="clock"
              title="Pengajuan"
              description="Tanggal, jam, jenis hari, dan uraian pekerjaan."
            >
              <InfoGrid>
                <InfoItem
                  label="Tanggal"
                  value={formatDateID(request.requestDate)}
                />
                <InfoItem
                  label="Jenis hari"
                  value={<OvertimeDayTag dayType={request.dayType} />}
                />
                <InfoItem
                  label="Jam"
                  value={`${request.startTime}–${request.endTime}`}
                />
                <InfoItem
                  label="Durasi diajukan"
                  value={overtimeHoursLabel(request.requestedMinutes)}
                />
                <InfoItem
                  label="Uraian"
                  value={request.workDescription}
                  full
                />
                <InfoItem
                  label="Diajukan"
                  value={formatDateTimeID(request.submittedAt)}
                  full
                />
              </InfoGrid>
            </FormSection>

            <FormSection
              icon="cal"
              title="Jam & Ekuivalen"
              description="Nominal rupiah dihitung di Payroll, bukan di modul ini."
            >
              <InfoGrid>
                <InfoItem
                  label="Jam disetujui"
                  value={overtimeHoursLabel(request.approvedMinutes)}
                />
                <InfoItem
                  label="Jam ekuivalen"
                  value={overtimeHoursLabel(request.equivalentMinutes)}
                />
                <InfoItem
                  label="Rumus"
                  value={
                    request.approvedMinutes
                      ? overtimeFormulaLabel(
                          request.approvedMinutes,
                          request.dayType
                        )
                      : `${overtimeFormulaLabel(
                          request.requestedMinutes,
                          request.dayType
                        )} (perkiraan)`
                  }
                  full
                />
              </InfoGrid>
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

            {mode === "staff" && week && (
              <FormSection
                icon="pipe"
                title="Lembur Minggu Ini"
                description={`${formatDateID(week.start)}–${formatDateID(
                  week.end
                )} untuk karyawan ini.`}
              >
                <InfoGrid>
                  <InfoItem
                    label="Disetujui"
                    value={overtimeHoursLabel(weekApprovedMinutes)}
                  />
                  <InfoItem
                    label="Ekuivalen"
                    value={overtimeHoursLabel(weekEquivalentMinutes)}
                  />
                  <InfoItem
                    label="Menunggu"
                    value={overtimeHoursLabel(weekPendingMinutes)}
                  />
                </InfoGrid>
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

      <OvertimeDecisionDialog
        open={
          dialog === "approve" ||
          dialog === "reject" ||
          dialog === "hr-cancel"
        }
        mode={
          (dialog === "approve"
            ? "approve"
            : dialog === "reject"
              ? "reject"
              : "hr-cancel") as OvertimeDecisionMode
        }
        request={request}
        busy={busy}
        error={actionError}
        onClose={() => setDialog(null)}
        onConfirm={(approvedMinutes, reason) => {
          if (dialog === "approve") {
            void runDecision("Disetujui", approvedMinutes, reason);
          } else if (dialog === "reject") {
            void runDecision("Ditolak", null, reason);
          } else {
            void runHrCancel(reason);
          }
        }}
      />

      {dialog === "own-cancel" && request && (
        <div className="rl">
          <ConfirmDialog
            title="Batalkan pengajuan lembur?"
            description={`Pengajuan ${formatDateID(
              request.requestDate
            )} pukul ${request.startTime}–${request.endTime} akan ditarik dari antrean.`}
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
