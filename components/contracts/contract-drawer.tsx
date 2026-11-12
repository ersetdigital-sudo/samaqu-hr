"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoGrid, InfoItem } from "@/components/ui/detail-info";
import { FormSection } from "@/components/ui/form-section";
import { contractStatusTone } from "@/lib/contracts/constants";
import { contractDurationLabel, tenureLabel } from "@/lib/contracts/rules";
import type {
  Contract,
  ContractDetail,
  ContractHistoryEntry,
} from "@/lib/contracts/types";
import { ini } from "@/lib/data";
import { formatDateTimeID } from "@/lib/datetime";
import { formatIsoDateID } from "@/lib/employees/format";

/** Nama field yang berubah, untuk ringkasan audit trail. */
function changedFields(entry: ContractHistoryEntry): string[] {
  const changes = entry.changes as {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  if (!changes?.before || !changes?.after) return [];

  return Object.keys(changes.after).filter(
    (key) =>
      JSON.stringify(changes.before?.[key]) !==
      JSON.stringify(changes.after?.[key])
  );
}

export function ContractDrawer({
  employeeId,
  onClose,
  onAdd,
  onEdit,
  onRenew,
  onEnd,
  onChanged,
}: {
  employeeId: string | null;
  onClose: () => void;
  onAdd: (employeeId: string) => void;
  onEdit: (contract: Contract) => void;
  onRenew: (contract: Contract) => void;
  onEnd: (contract: Contract) => Promise<boolean>;
  onChanged: (message: string) => void;
}) {
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!employeeId) {
      setDetail(null);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/contracts/employee/${employeeId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Gagal memuat detail kontrak");
        return (await response.json()) as ContractDetail;
      })
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Gagal memuat detail kontrak"
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [employeeId, reloadKey]);

  const current = detail?.contracts.find(
    (contract) => contract.status === "Aktif"
  );

  const handleEnd = async (contract: Contract) => {
    const ended = await onEnd(contract);
    if (ended) setReloadKey((key) => key + 1);
  };

  return (
    <DetailDrawer
      open={Boolean(employeeId)}
      title="Kontrak & Masa Kerja"
      description="Riwayat kontrak dan jejak perubahan karyawan."
      size="md"
      onClose={onClose}
      footer={
        detail && !loading ? (
          <>
            <button
              type="button"
              className="btn btn-p"
              onClick={() => onAdd(detail.employee.id)}
            >
              <Icon name="plus" /> Tambah Kontrak
            </button>
            {current && (
              <>
                {current.employmentType !== "Tetap" && (
                  <button
                    type="button"
                    className="btn btn-g"
                    onClick={() => onRenew(current)}
                  >
                    Perpanjang
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-g"
                  onClick={() => onEdit(current)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-d"
                  onClick={() => void handleEnd(current)}
                >
                  Akhiri
                </button>
              </>
            )}
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {loading && <div className="sub text-[13px]">Memuat kontrak…</div>}

        {error && (
          <div className="tag t-bad w-full justify-center">{error}</div>
        )}

        {detail && !loading && (
          <>
            <FormSection
              icon="users"
              title="Karyawan"
              description="Ringkasan masa kerja dan kontrak berjalan."
            >
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="av"
                  style={{ width: 56, height: 56, fontSize: 18 }}
                >
                  {ini(detail.employee.fullName)}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-[17px] leading-tight break-words">
                    {detail.employee.fullName}
                  </div>
                  <div className="sub text-[12px]">
                    {detail.employee.id} · {detail.employee.position}
                  </div>
                  <div className="sub text-[11px]">
                    {detail.employee.department}
                  </div>
                </div>
              </div>

              <InfoGrid>
                <InfoItem
                  label="Masa kerja"
                  value={
                    <>
                      {tenureLabel(detail.employee.joinedAt)}
                      <div className="text-[11px] font-normal sub">
                        sejak {formatIsoDateID(detail.employee.joinedAt)}
                      </div>
                    </>
                  }
                />
                <InfoItem
                  label="Kontrak berjalan"
                  value={
                    <>
                      {current ? contractDurationLabel(current) : "Tidak ada"}
                      <div className="text-[11px] font-normal sub">
                        {current
                          ? `${current.contractNumber} · ${current.employmentType}`
                          : "Belum ada kontrak aktif"}
                      </div>
                    </>
                  }
                />
              </InfoGrid>
            </FormSection>

            <FormSection
              icon="job"
              title="Riwayat Kontrak"
              description="Seluruh kontrak karyawan, terbaru lebih dulu."
            >
              <div className="flex flex-col gap-2">
                {detail.contracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="p-3 rounded-xl"
                    style={{ background: "#FAF7F5" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-[13px] break-words">
                          {contract.contractNumber}
                        </div>
                        <div className="text-[11px] sub">
                          {formatIsoDateID(contract.startDate)} –{" "}
                          {formatIsoDateID(contract.endDate)} ·{" "}
                          {contractDurationLabel(contract)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {contract.historicalOverlap && (
                          <span className="tag t-mute">Data Historis</span>
                        )}
                        <span
                          className={`tag ${contractStatusTone(
                            contract.displayStatus
                          )}`}
                        >
                          {contract.displayStatus}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] sub mt-1">
                      {contract.employmentType}
                      {contract.previousContractId
                        ? " · perpanjangan dari kontrak sebelumnya"
                        : ""}
                    </div>
                    {contract.note && (
                      <div className="text-[11px] sub mt-1">{contract.note}</div>
                    )}
                    {contract.status === "Aktif" && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button
                          type="button"
                          className="btn btn-g !py-1 !px-3"
                          onClick={() => onEdit(contract)}
                        >
                          Edit
                        </button>
                        {contract.employmentType !== "Tetap" && (
                          <button
                            type="button"
                            className="btn btn-g !py-1 !px-3"
                            onClick={() => onRenew(contract)}
                          >
                            Perpanjang
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-d !py-1 !px-3"
                          onClick={() => void handleEnd(contract)}
                        >
                          Akhiri
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {detail.contracts.length === 0 && (
                  <div className="sub text-[13px]">
                    Belum ada kontrak untuk karyawan ini.
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection
              icon="clock"
              title="Jejak Perubahan"
              description="Audit perubahan data kontrak."
            >
              <div className="flex flex-col gap-3">
                {detail.history.map((entry) => {
                  const fields = changedFields(entry);
                  return (
                    <div className="flex gap-3" key={entry.id}>
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: "var(--pink)" }}
                      />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">
                          {entry.event}
                        </div>
                        <div className="text-[11px] sub">
                          {formatDateTimeID(entry.changedAt)}
                          {fields.length > 0
                            ? ` · ${fields.join(", ")}`
                            : ""}
                          {entry.changedBy
                            ? ` · oleh ${
                                entry.changedByName ??
                                (detail.actorNamesResolved
                                  ? "Pengguna terhapus"
                                  : entry.changedBy.slice(0, 8))
                              }`
                            : ""}
                        </div>
                        {entry.note && (
                          <div className="text-[11px] sub">{entry.note}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {detail.history.length === 0 && (
                  <div className="sub text-[13px]">
                    Belum ada jejak perubahan.
                  </div>
                )}
              </div>
            </FormSection>
          </>
        )}
      </div>
    </DetailDrawer>
  );
}
