"use client";

import { useEffect, useState } from "react";
import type { ContractModalState } from "@/components/contracts/contract-modal-state";
import {
  defaultRenewalStart,
  validateContractInput,
} from "@/lib/contracts/rules";
import type {
  ContractEmployeeRef,
  ContractInput,
} from "@/lib/contracts/types";
import { formatIsoDateID, isoToday } from "@/lib/employees/format";
import { EMPLOYMENT_TYPES, type EmploymentType } from "@/lib/employees/types";

const emptyForm = (employeeId: string | null = null): ContractInput => ({
  employeeId: employeeId ?? "",
  startDate: isoToday(),
  endDate: null,
  employmentType: "Kontrak",
  note: null,
  syncEmployeeType: false,
});

const TITLES = {
  create: "Tambah Kontrak",
  renew: "Perpanjang Kontrak",
  edit: "Edit Kontrak",
} as const;

export function ContractModal({
  state,
  employees,
  onClose,
  onSaved,
}: {
  state: ContractModalState | null;
  employees: ContractEmployeeRef[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<ContractInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [gapReason, setGapReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state) return;

    if (state.mode === "edit" && state.contract) {
      setForm({
        employeeId: state.contract.employeeId,
        startDate: state.contract.startDate,
        endDate: state.contract.endDate,
        employmentType: state.contract.employmentType,
        note: state.contract.note,
        syncEmployeeType: false,
      });
    } else if (state.mode === "renew" && state.contract) {
      setForm({
        employeeId: state.contract.employeeId,
        // Default: sehari setelah kontrak lama berakhir.
        startDate:
          defaultRenewalStart(state.contract.endDate) ?? isoToday(),
        endDate: null,
        employmentType: state.contract.employmentType,
        note: null,
        syncEmployeeType: false,
      });
    } else {
      setForm(emptyForm(state.employeeId));
    }

    setGapReason("");
    setErrors({});
    setFormError(null);
    setSaving(false);
  }, [state]);

  if (!state) return null;

  const selectedEmployee = employees.find(
    (employee) => employee.id === form.employeeId
  );
  const isRenew = state.mode === "renew";
  const requiresSync =
    Boolean(selectedEmployee) &&
    form.employmentType !== selectedEmployee?.employmentType &&
    !isRenew;

  const renewDefaultStart =
    isRenew && state.contract
      ? defaultRenewalStart(state.contract.endDate)
      : null;
  const gapRequired =
    Boolean(renewDefaultStart) && form.startDate !== renewDefaultStart;
  const renewBlocked = isRenew && state.contract?.employmentType === "Tetap";

  const set = <K extends keyof ContractInput,>(
    key: K,
    value: ContractInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const submit = async () => {
    if (renewBlocked) {
      setFormError(
        "Kontrak Tetap tidak bisa diperpanjang. Gunakan perubahan jenis hubungan kerja."
      );
      return;
    }

    if (isRenew && gapRequired && !gapReason.trim()) {
      setErrors({
        gapReason: "Alasan jeda wajib diisi bila tanggal mulai diubah",
      });
      setFormError(
        "Tanggal mulai berbeda dari default — isi alasan jeda kontrak."
      );
      return;
    }

    const nextErrors = validateContractInput(
      form,
      isRenew ? undefined : selectedEmployee?.employmentType
    ) as Record<string, string>;
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFormError("Periksa kembali field yang ditandai merah.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const url =
        state.mode === "create"
          ? "/api/contracts"
          : state.mode === "renew"
            ? `/api/contracts/${state.contract?.id}/renew`
            : `/api/contracts/${state.contract?.id}`;

      const method = state.mode === "edit" ? "PATCH" : "POST";
      const payload =
        state.mode === "renew"
          ? {
              startDate: form.startDate,
              endDate: form.endDate,
              note: form.note,
              gapReason: gapReason.trim() || null,
            }
          : form;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        errors?: Record<string, string>;
      };

      if (!response.ok) {
        if (data.errors) setErrors(data.errors);
        throw new Error(data.error ?? "Gagal menyimpan kontrak");
      }

      onSaved(
        state.mode === "renew"
          ? "Kontrak diperpanjang — record baru dibuat"
          : state.mode === "edit"
            ? "Kontrak diperbarui"
            : "Kontrak baru ditambahkan"
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menyimpan kontrak"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal show"
      id="contractModal"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="card w-full max-w-[720px] shadow-xl">
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: "var(--line)" }}
        >
          <div>
            <div className="font-bold text-[17px]">{TITLES[state.mode]}</div>
            <div className="sub text-[13px]">
              {state.mode === "renew"
                ? `Kontrak ${state.contract?.contractNumber} akan ditandai Diperpanjang dan digantikan record baru.`
                : "Karyawan dipilih dari Direktori; data profil tidak diduplikasi di sini."}
            </div>
          </div>
          <button className="btn btn-g !px-3" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="p-6">
          {formError && (
            <div
              className="mb-4 p-3 rounded-xl text-[12px]"
              style={{ background: "var(--badb)", color: "var(--bad)" }}
            >
              {formError}
            </div>
          )}

          {isRenew && selectedEmployee && (
            <div
              className="mb-5 p-3 rounded-xl text-[12px]"
              style={{ background: "#FAF7F5" }}
            >
              <b>{selectedEmployee.fullName}</b> · {selectedEmployee.id}
              <div className="sub">
                Jenis hubungan kerja mengikuti kontrak sebelumnya. Tanggal
                mulai default: <b>{formatIsoDateID(renewDefaultStart)}</b>{" "}
                (sehari setelah kontrak lama berakhir).
              </div>
            </div>
          )}

          {isRenew && renewBlocked && (
            <div
              className="mb-5 p-3 rounded-xl text-[12px]"
              style={{ background: "var(--badb)", color: "var(--bad)" }}
            >
              Kontrak Tetap tidak bisa diperpanjang. Perubahan jenis hubungan
              kerja dilakukan lewat mekanisme yang tercatat, bukan perpanjangan.
            </div>
          )}

          {isRenew && !renewBlocked && gapRequired && (
            <div className="mb-5">
              <label className="lbl">Alasan jeda *</label>
              <input
                className="inp"
                placeholder="cth. jeda administratif sebelum kontrak baru"
                value={gapReason}
                onChange={(event) => {
                  setGapReason(event.target.value);
                  setErrors((prev) => ({ ...prev, gapReason: "" }));
                }}
              />
              {errors.gapReason && (
                <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
                  {errors.gapReason}
                </div>
              )}
              <div className="text-[11px] sub mt-1">
                Wajib karena tanggal mulai berbeda dari default. Alasan
                tercatat di jejak perubahan.
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <div className="md:col-span-2">
              <label className="lbl">Karyawan *</label>
              <select
                className="inp"
                value={form.employeeId}
                disabled={state.mode !== "create"}
                onChange={(event) => set("employeeId", event.target.value)}
              >
                <option value="">— Pilih karyawan —</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName} · {employee.id} · {employee.department}
                  </option>
                ))}
              </select>
              {errors.employeeId && (
                <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
                  {errors.employeeId}
                </div>
              )}
            </div>

            <div>
              <label className="lbl">Tanggal mulai *</label>
              <input
                className="inp"
                type="date"
                value={form.startDate}
                onChange={(event) => set("startDate", event.target.value)}
              />
              {errors.startDate && (
                <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
                  {errors.startDate}
                </div>
              )}
            </div>

            <div>
              <label className="lbl">
                Tanggal berakhir {form.employmentType === "Tetap" ? "" : "*"}
              </label>
              <input
                className="inp"
                type="date"
                value={form.endDate ?? ""}
                disabled={form.employmentType === "Tetap"}
                onChange={(event) =>
                  set("endDate", event.target.value || null)
                }
              />
              {errors.endDate && (
                <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
                  {errors.endDate}
                </div>
              )}
              {form.employmentType === "Tetap" && (
                <div className="text-[11px] sub mt-1">
                  Kontrak Tetap boleh tanpa tanggal berakhir.
                </div>
              )}
            </div>

            <div>
              <label className="lbl">Jenis hubungan kerja</label>
              <select
                className="inp"
                value={form.employmentType}
                disabled={isRenew}
                onChange={(event) => {
                  const nextType = event.target.value as EmploymentType;
                  set("employmentType", nextType);
                  // Tanggal akhir tidak pernah disimpan untuk kontrak Tetap.
                  if (nextType === "Tetap") set("endDate", null);
                }}
              >
                {EMPLOYMENT_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              {errors.employmentType && (
                <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
                  {errors.employmentType}
                </div>
              )}
            </div>

            <div>
              <label className="lbl">Catatan</label>
              <input
                className="inp"
                placeholder="cth. perpanjangan tahun kedua"
                value={form.note ?? ""}
                onChange={(event) => set("note", event.target.value || null)}
              />
            </div>

            {requiresSync && (
              <div className="md:col-span-2">
                <label
                  className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer"
                  style={{ borderColor: "var(--line)" }}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={Boolean(form.syncEmployeeType)}
                    onChange={(event) =>
                      set("syncEmployeeType", event.target.checked)
                    }
                  />
                  <span className="text-[12px]">
                    <b>Sinkronkan jenis hubungan kerja karyawan</b>
                    <span className="sub block">
                      Data Direktori saat ini{" "}
                      <b>{selectedEmployee?.employmentType}</b>. Mengubahnya ke{" "}
                      <b>{form.employmentType}</b> akan dicatat di jejak
                      perubahan.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {!requiresSync && selectedEmployee && (
              <div className="md:col-span-2 text-[11px] sub">
                Jenis hubungan kerja karyawan saat ini:{" "}
                <b>{selectedEmployee.employmentType}</b> · bergabung{" "}
                {formatIsoDateID(selectedEmployee.joinedAt)}
              </div>
            )}
          </div>
        </div>

        <div
          className="flex justify-end gap-2 px-6 py-4 border-t"
          style={{
            borderColor: "var(--line)",
            background: "#FCFBFA",
            borderRadius: "0 0 14px 14px",
          }}
        >
          <button className="btn btn-g" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button
            className="btn btn-p"
            onClick={() => void submit()}
            disabled={saving || renewBlocked}
          >
            {saving
              ? "Menyimpan…"
              : state.mode === "renew"
                ? "Perpanjang"
                : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
