"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { employeeStatusTone } from "@/components/employees/status-tone";
import { Icon } from "@/components/icons";
import { ini } from "@/lib/data";
import { formatIsoDateID } from "@/lib/employees/format";
import type { EmployeeDetail } from "@/lib/employees/types";

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: "#FAF7F5" }}>
      <div className="sub text-[11px]">{label}</div>
      <div className="font-semibold text-[13px] break-words">{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="font-bold mb-3">{title}</div>
      {children}
    </div>
  );
}

export function EmployeeDrawer({
  employeeId,
  onClose,
  onEdit,
  onChanged,
}: {
  employeeId: string | null;
  onClose: () => void;
  onEdit: (detail: EmployeeDetail) => void;
  onChanged: (message: string) => void;
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
      setReactivating(false);
      setReason("");
      setReasonError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/employees/${employeeId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Gagal memuat detail karyawan");
        return (await response.json()) as { employee: EmployeeDetail };
      })
      .then((data) => {
        if (active) setDetail(data.employee);
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
  }, [employeeId, reloadKey]);

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

  return (
    <div className={`drawer ${employeeId ? "show" : ""}`} id="empDrawer">
      {employeeId && (
        <>
          <div
            className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="font-bold">Detail Karyawan</span>
            <button className="btn btn-g !px-3" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="p-6">
            {loading && <div className="sub text-[13px]">Memuat detail…</div>}

            {error && (
              <div className="tag t-bad mb-4 w-full justify-center">{error}</div>
            )}

            {detail && !loading && (
              <>
                <div className="flex items-center gap-4 mb-5">
                  <div className="av" style={{ width: 56, height: 56, fontSize: 18 }}>
                    {ini(detail.fullName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[19px] leading-tight">
                      {detail.fullName}
                    </div>
                    <div className="sub">{detail.position}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`tag ${employeeStatusTone(detail.status)}`}>
                        {detail.status}
                      </span>
                      <span className="tag t-mute">{detail.employmentType}</span>
                      <span className="tag t-mute">{detail.id}</span>
                    </div>
                  </div>
                </div>

                <Section title="Identitas">
                  <div className="grid grid-cols-2 gap-3">
                    <Info label="Tempat lahir" value={detail.birthPlace} />
                    <Info
                      label="Tanggal lahir"
                      value={formatIsoDateID(detail.birthDate)}
                    />
                    <Info label="Jenis kelamin" value={detail.gender} />
                    <Info label="Alamat" value={detail.address} />
                  </div>
                  <div
                    className="mt-3 p-3 rounded-xl border"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="sub text-[11px]">NIK KTP</span>
                      <span className="tag t-warn">Akses terbatas</span>
                    </div>
                    <div className="font-semibold text-[13px] mt-1 tracking-wide">
                      {detail.nik}
                    </div>
                    <div className="text-[11px] sub mt-1">
                      Hanya tampil di detail identitas. Tidak disertakan pada
                      daftar, hasil pencarian, maupun ekspor.
                    </div>
                  </div>
                </Section>

                <Section title="Data Pekerjaan">
                  <div className="grid grid-cols-2 gap-3">
                    <Info label="Jabatan" value={detail.position} />
                    <Info label="Departemen" value={detail.department} />
                    <Info label="Lokasi kerja" value={detail.location} />
                    <Info label="Atasan langsung" value={detail.managerName ?? "—"} />
                    <Info
                      label="Tanggal bergabung"
                      value={formatIsoDateID(detail.joinedAt)}
                    />
                    <Info label="Hubungan kerja" value={detail.employmentType} />
                  </div>
                </Section>

                <Section title="Kontak">
                  <div className="grid grid-cols-2 gap-3">
                    <Info label="Email pribadi" value={detail.personalEmail} />
                    <Info label="Email kerja" value={detail.workEmail} />
                    <Info label="Nomor HP" value={detail.phone} />
                    <Info
                      label="Kontak darurat"
                      value={`${detail.emergencyName} (${detail.emergencyRelation})`}
                    />
                    <Info label="Nomor darurat" value={detail.emergencyPhone} />
                  </div>
                </Section>

                <Section title="Probation">
                  <div className="grid grid-cols-2 gap-3">
                    <Info
                      label="Mulai probation"
                      value={formatIsoDateID(detail.probationStart)}
                    />
                    <Info
                      label="Berakhir probation"
                      value={formatIsoDateID(detail.probationEnd)}
                    />
                  </div>
                </Section>

                <Section title="Kontrak">
                  <div className="grid grid-cols-2 gap-3">
                    <Info
                      label="Berakhir kontrak aktif"
                      value={formatIsoDateID(detail.currentContractEnd)}
                    />
                  </div>
                  <div className="text-[11px] sub mt-2">
                    Ringkasan dari modul Kontrak &amp; Masa Kerja (sumber tunggal).{" "}
                    <Link
                      className="font-semibold underline"
                      href="/employees/kontrak"
                    >
                      Kelola kontrak
                    </Link>
                  </div>
                </Section>

                {detail.status === "Nonaktif" && (
                  <div
                    className="mb-3 p-3 rounded-xl border"
                    style={{ borderColor: "var(--line)" }}
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
                        <div className="flex flex-wrap gap-2 mt-2">
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
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[12px] font-semibold">
                            Karyawan Nonaktif
                          </div>
                          <div className="text-[11px] sub">
                            Reaktivasi butuh alasan dan tercatat di audit.
                          </div>
                        </div>
                        <button
                          className="btn btn-g"
                          onClick={() => setReactivating(true)}
                          disabled={updating}
                        >
                          Reaktivasi
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-p"
                    onClick={() => onEdit(detail)}
                  >
                    <Icon name="file" /> Edit Data
                  </button>
                  {detail.status !== "Nonaktif" && (
                    <button
                      className="btn btn-d"
                      onClick={() => void deactivate()}
                      disabled={updating}
                    >
                      {updating ? "Menyimpan…" : "Nonaktifkan"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
