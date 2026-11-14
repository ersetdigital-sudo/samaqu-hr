"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmployeeDocumentsPanel } from "@/components/documents/employee-documents-panel";
import { PerformanceEmployeeHistory } from "@/components/performance/performance-employee-history";
import { EmployeePositionHistory } from "@/components/position-history/employee-position-history";
import { employeeStatusTone } from "@/components/employees/status-tone";
import { Icon } from "@/components/icons";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoGrid, InfoItem } from "@/components/ui/detail-info";
import { FormSection, FormSectionNav } from "@/components/ui/form-section";
import {
  useDrawerSectionNav,
  type DrawerNavSection,
} from "@/components/ui/use-drawer-section-nav";
import { ini } from "@/lib/data";
import { formatIsoDateID } from "@/lib/employees/format";
import {
  cachedEmployeeDetail,
  invalidateEmployeeDetail,
  loadEmployeeDetail,
} from "@/lib/employees/detail-cache";
import type { EmployeeDetail, EmployeeSummary } from "@/lib/employees/types";

const EMPLOYEE_SECTIONS: DrawerNavSection[] = [
  { id: "employee-summary", label: "Karyawan" },
  { id: "employee-identity", label: "Identitas" },
  { id: "employee-work", label: "Pekerjaan" },
  { id: "employee-contact", label: "Kontak" },
  { id: "employee-probation", label: "Probation" },
  { id: "employee-contract", label: "Kontrak" },
  { id: "employee-position", label: "Riwayat Jabatan" },
  { id: "employee-documents", label: "Dokumen" },
  { id: "employee-performance", label: "Performa" },
];

const EMPLOYEE_STATUS_SECTION: DrawerNavSection = {
  id: "employee-status",
  label: "Status",
};

export function EmployeeDrawer({
  employeeId,
  preview = null,
  todayIso,
  positionHistoryVersion,
  onClose,
  onEdit,
  onChanged,
  onRecordPosition,
}: {
  employeeId: string | null;
  preview?: EmployeeSummary | null;
  todayIso: string;
  positionHistoryVersion: number;
  onClose: () => void;
  onEdit: (detail: EmployeeDetail) => void;
  onChanged: (message: string) => void;
  onRecordPosition: (employeeId: string) => void;
}) {
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      setReactivating(false);
      setReason("");
      setReasonError(null);
      return;
    }

    const cached = cachedEmployeeDetail(employeeId);
    setDetail(cached);
    if (cached) {
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    loadEmployeeDetail(employeeId)
      .then((employee) => {
        if (active) setDetail(employee);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Gagal memuat detail karyawan"
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [employeeId, reloadKey, positionHistoryVersion]);

  const deactivate = async () => {
    if (!detail) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/employees/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Nonaktif" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Gagal mengubah status karyawan");
      }
      invalidateEmployeeDetail(detail.id);
      setReloadKey((key) => key + 1);
      onChanged("Karyawan dinonaktifkan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status");
    } finally {
      setUpdating(false);
    }
  };

  // Reaktivasi wajib beralasan; API yang menentukan status & validasi akhir.
  const reactivate = async () => {
    if (!detail) return;
    if (!reason.trim()) {
      setReasonError("Alasan reaktivasi wajib diisi");
      return;
    }

    setUpdating(true);
    setReasonError(null);
    try {
      const response = await fetch(
        `/api/employees/${detail.id}/reactivate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Gagal mereaktivasi karyawan");
      }
      setReactivating(false);
      setReason("");
      invalidateEmployeeDetail(detail.id);
      setReloadKey((key) => key + 1);
      onChanged(
        "Karyawan direaktivasi — kontrak baru dibuat lewat modul Kontrak"
      );
    } catch (err) {
      setReasonError(
        err instanceof Error ? err.message : "Gagal mereaktivasi karyawan"
      );
    } finally {
      setUpdating(false);
    }
  };

  const summary = detail ?? preview;

  const sections = useMemo(
    () =>
      detail?.status === "Nonaktif"
        ? [...EMPLOYEE_SECTIONS, EMPLOYEE_STATUS_SECTION]
        : EMPLOYEE_SECTIONS,
    [detail?.status]
  );
  const { bodyRef, activeId, scrollToSection } = useDrawerSectionNav(
    sections,
    Boolean(detail)
  );

  const footer = detail ? (
    <>
      <button
        type="button"
        className="btn btn-p"
        onClick={() => onEdit(detail)}
      >
        <Icon name="file" /> Edit Data
      </button>
      {detail.status === "Nonaktif" ? (
        !reactivating && (
          <button
            type="button"
            className="btn btn-g"
            onClick={() => {
              setReactivating(true);
              requestAnimationFrame(() => {
                document
                  .getElementById("employee-status")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
            disabled={updating}
          >
            Reaktivasi
          </button>
        )
      ) : (
        <button
          type="button"
          className="btn btn-d"
          onClick={() => void deactivate()}
          disabled={updating}
        >
          {updating ? "Menyimpan…" : "Nonaktifkan"}
        </button>
      )}
    </>
  ) : undefined;

  return (
    <DetailDrawer
      open={Boolean(employeeId)}
      title="Detail Karyawan"
      description="Informasi lengkap data karyawan dari Direktori."
      size="md"
      onClose={onClose}
      footer={footer}
      bodyRef={bodyRef}
      subnav={
        <FormSectionNav
          items={sections}
          activeId={activeId}
          onSelect={scrollToSection}
        />
      }
    >
      <div className="flex flex-col gap-4">
        {summary && (
          <FormSection
            sectionId="employee-summary"
            icon="users"
            title="Karyawan"
            description="Ringkasan identitas dan status kepegawaian."
          >
            <div className="flex items-center gap-4">
              <div
                className="av"
                style={{ width: 56, height: 56, fontSize: 18 }}
              >
                {ini(summary.fullName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[17px] leading-tight break-words">
                  {summary.fullName}
                </div>
                <div className="sub text-[12px] break-words">
                  {summary.position}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className={`tag ${employeeStatusTone(summary.status)}`}
                  >
                    {summary.status}
                  </span>
                  <span className="tag t-mute">{summary.employmentType}</span>
                  <span className="tag t-mute">{summary.id}</span>
                </div>
              </div>
            </div>
          </FormSection>
        )}

        {loading && !detail && (
          <div className="sub text-[13px]">Melengkapi detail karyawan…</div>
        )}

        {error && <div className="tag t-bad w-full justify-center">{error}</div>}

        {detail && (
          <>
            <FormSection
              sectionId="employee-identity"
              icon="users"
              title="Identitas"
              description="Data diri dan dokumen identitas."
            >
              <InfoGrid>
                <InfoItem label="Tempat lahir" value={detail.birthPlace} />
                <InfoItem
                  label="Tanggal lahir"
                  value={formatIsoDateID(detail.birthDate)}
                />
                <InfoItem label="Jenis kelamin" value={detail.gender} />
                <InfoItem label="Alamat" value={detail.address} full />
                <InfoItem
                  label="NIK KTP (akses terbatas)"
                  value={
                    <span className="tracking-wide">{detail.nik}</span>
                  }
                  full
                />
              </InfoGrid>
              <div className="text-[11px] sub mt-2">
                NIK hanya tampil di detail identitas. Tidak disertakan pada
                daftar, hasil pencarian, maupun ekspor.
              </div>
            </FormSection>

            <FormSection
              sectionId="employee-work"
              icon="job"
              title="Data Pekerjaan"
              description="Posisi dan penempatan karyawan."
            >
              <InfoGrid>
                <InfoItem label="Jabatan" value={detail.position} />
                <InfoItem label="Departemen" value={detail.department} />
                <InfoItem label="Lokasi kerja" value={detail.location} />
                <InfoItem
                  label="Atasan langsung"
                  value={detail.managerName ?? "—"}
                />
                <InfoItem
                  label="Tanggal bergabung"
                  value={formatIsoDateID(detail.joinedAt)}
                />
                <InfoItem
                  label="Hubungan kerja"
                  value={detail.employmentType}
                />
              </InfoGrid>
            </FormSection>

            <FormSection
              sectionId="employee-contact"
              icon="mail"
              title="Kontak"
              description="Email dan nomor yang bisa dihubungi."
            >
              <InfoGrid>
                <InfoItem
                  label="Email pribadi"
                  value={detail.personalEmail}
                  full
                />
                <InfoItem label="Email kerja" value={detail.workEmail} full />
                <InfoItem label="Nomor HP" value={detail.phone} />
                <InfoItem
                  label="Kontak darurat"
                  value={`${detail.emergencyName} (${detail.emergencyRelation})`}
                />
                <InfoItem
                  label="Nomor darurat"
                  value={detail.emergencyPhone}
                />
              </InfoGrid>
            </FormSection>

            <FormSection
              sectionId="employee-probation"
              icon="clock"
              title="Probation"
              description="Masa percobaan karyawan."
            >
              <InfoGrid>
                <InfoItem
                  label="Mulai probation"
                  value={formatIsoDateID(detail.probationStart)}
                />
                <InfoItem
                  label="Berakhir probation"
                  value={formatIsoDateID(detail.probationEnd)}
                />
              </InfoGrid>
            </FormSection>

            <FormSection
              sectionId="employee-contract"
              icon="job"
              title="Kontrak"
              description="Ringkasan dari modul Kontrak & Masa Kerja."
            >
              <InfoGrid single>
                <InfoItem
                  label="Berakhir kontrak aktif"
                  value={formatIsoDateID(detail.currentContractEnd)}
                />
              </InfoGrid>
              <div className="text-[11px] sub mt-2">
                Sumber tunggal tanggal kontrak.{" "}
                <Link
                  className="font-semibold underline"
                  href="/employees/kontrak"
                >
                  Kelola kontrak
                </Link>
              </div>
            </FormSection>

            <FormSection
              sectionId="employee-position"
              icon="clock"
              title="Riwayat Jabatan"
              description="Perubahan jabatan, departemen, atasan, dan lokasi kerja."
              action={
                detail.status !== "Nonaktif" ? (
                  <button
                    className="btn btn-g !py-1 !px-3"
                    onClick={() => onRecordPosition(detail.id)}
                  >
                    Catat Perubahan
                  </button>
                ) : undefined
              }
            >
              <EmployeePositionHistory
                employeeId={detail.id}
                refreshKey={positionHistoryVersion}
              />
              {detail.status === "Nonaktif" && (
                <div className="text-[11px] sub mt-2">
                  Karyawan Nonaktif tidak bisa dimutasi. Reaktivasi lebih dulu
                  lewat aksi di footer.
                </div>
              )}
            </FormSection>

            <FormSection
              sectionId="employee-documents"
              icon="file"
              title="Dokumen & Berkas"
              description="Dokumen pribadi yang diunggah HR."
            >
              <EmployeeDocumentsPanel
                employeeId={detail.id}
                todayIso={todayIso}
                showHeading={false}
                onMutated={(message) => onChanged(message)}
              />
            </FormSection>

            <FormSection
              sectionId="employee-performance"
              icon="target"
              title="Performa"
              description="Riwayat skor Final dari periode penilaian yang sudah ditutup."
            >
              <PerformanceEmployeeHistory employeeId={detail.id} />
            </FormSection>

            {detail.status === "Nonaktif" && (
              <FormSection
                sectionId="employee-status"
                icon="clock"
                title="Status Karyawan"
                description="Reaktivasi karyawan Nonaktif."
              >
                {reactivating ? (
                  <>
                    <label className="lbl">Alasan reaktivasi *</label>
                    <textarea
                      className="inp"
                      rows={2}
                      placeholder="cth. karyawan dipekerjakan kembali"
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        setReasonError(null);
                      }}
                    />
                    {reasonError && (
                      <div
                        className="text-[11px] mt-1"
                        style={{ color: "var(--bad)" }}
                      >
                        {reasonError}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        className="btn btn-p"
                        onClick={() => void reactivate()}
                        disabled={updating}
                      >
                        {updating ? "Menyimpan…" : "Reaktivasi"}
                      </button>
                      <button
                        className="btn btn-g"
                        onClick={() => {
                          setReactivating(false);
                          setReason("");
                          setReasonError(null);
                        }}
                        disabled={updating}
                      >
                        Batal
                      </button>
                    </div>
                    <div className="text-[11px] sub mt-2">
                      Reaktivasi tidak membuat kontrak otomatis dan tidak
                      mengubah Employee ID, jenis hubungan kerja, maupun
                      probation.
                    </div>
                  </>
                ) : (
                  <div className="text-[12px] sub">
                    Karyawan berstatus Nonaktif. Gunakan tombol Reaktivasi di
                    footer; alasan wajib diisi dan tercatat di audit.
                  </div>
                )}
              </FormSection>
            )}
          </>
        )}
      </div>
    </DetailDrawer>
  );
}
