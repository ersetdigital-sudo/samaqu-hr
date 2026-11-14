"use client";

import { useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { FormSection } from "@/components/ui/form-section";
import { formatDateTimeID } from "@/lib/datetime";
import {
  jkkRiskClassLabel,
  validatePayrollSettings,
} from "@/lib/payroll/rules";
import {
  JKK_RISK_CLASSES,
  PTKP_STATUSES,
  type PayrollSettingsData,
  type TerRate,
} from "@/lib/payroll/types";

export function PayrollSettingsView({
  initialData,
  terRates,
}: {
  initialData: PayrollSettingsData;
  terRates: TerRate[];
}) {
  const { toast } = useRecruitment();
  const [settings, setSettings] = useState(initialData.settings);
  const [effectiveDate, setEffectiveDate] = useState(initialData.effectiveDate);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const importCount = (category: "A" | "B" | "C") =>
    terRates.filter((rate) => rate.category === category).length;

  const save = async () => {
    setError("");
    setMessage("");
    const errors = validatePayrollSettings(settings);
    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }
    if (!effectiveDate) {
      setError("Tanggal berlaku wajib diisi.");
      return;
    }
    if (!reason.trim()) {
      setError("Alasan perubahan wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/payroll/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          effectiveDate,
          reason: reason.trim(),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal menyimpan pengaturan payroll");
      }
      setReason("");
      setMessage("Pengaturan payroll disimpan.");
      toast("Pengaturan payroll disimpan");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan pengaturan payroll"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead
        title="Pengaturan Payroll"
        subtitle="Tarif dan batas payroll. Setiap perubahan memiliki tanggal berlaku dan riwayat."
      >
        <button
          type="button"
          className="btn btn-p"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? "Menyimpan…" : "Simpan Pengaturan"}
        </button>
      </PageHead>

      {error && (
        <div className="tag t-bad w-full justify-center mb-4">{error}</div>
      )}
      {message && (
        <div className="tag t-ok w-full justify-center mb-4">{message}</div>
      )}

      <div className="flex flex-col gap-4 max-w-[980px]">
        <FormSection
          icon="clock"
          title="Berlaku & Alasan"
          description="Tanggal berlaku dan alasan perubahan masuk ke riwayat."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="lbl" htmlFor="payroll-effective-date">
                Tanggal berlaku
              </label>
              <input
                id="payroll-effective-date"
                type="date"
                className="inp"
                value={effectiveDate}
                disabled={saving}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </div>
            <div>
              <label className="lbl" htmlFor="payroll-settings-reason">
                Alasan perubahan *
              </label>
              <input
                id="payroll-settings-reason"
                className="inp"
                maxLength={1000}
                value={reason}
                disabled={saving}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          icon="wallet"
          title="BPJS"
          description="Dasar iuran: gaji pokok + tunjangan tetap."
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["bpjsKesehatan.employerRate", "Kesehatan perusahaan (%)", settings.bpjsKesehatan.employerRate],
              ["bpjsKesehatan.employeeRate", "Kesehatan karyawan (%)", settings.bpjsKesehatan.employeeRate],
              ["bpjsKesehatan.salaryCap", "Batas upah kesehatan", settings.bpjsKesehatan.salaryCap ?? 0],
              ["bpjsKesehatan.salaryFloor", "Batas bawah kesehatan", settings.bpjsKesehatan.salaryFloor ?? 0],
              ["jht.employerRate", "JHT perusahaan (%)", settings.jht.employerRate],
              ["jht.employeeRate", "JHT karyawan (%)", settings.jht.employeeRate],
              ["jp.employerRate", "JP perusahaan (%)", settings.jp.employerRate],
              ["jp.employeeRate", "JP karyawan (%)", settings.jp.employeeRate],
              ["jp.salaryCap", "Batas upah JP", settings.jp.salaryCap ?? 0],
              ["jkmRate", "JKM (%)", settings.jkmRate],
            ].map(([key, label, value]) => (
              <label className="block" key={String(key)}>
                <span className="lbl">{label}</span>
                <input
                  type="number"
                  className="inp"
                  min={0}
                  step="0.01"
                  value={Number(value)}
                  disabled={saving}
                  onChange={(event) => {
                    const numeric = Number(event.target.value);
                    setSettings((current) => {
                      const next = structuredClone(current);
                      const parts = String(key).split(".");
                      if (parts.length === 1) {
                        (next as unknown as Record<string, unknown>)[parts[0]] = numeric;
                      } else {
                        (next as unknown as Record<string, Record<string, number>>)[parts[0]][parts[1]] = numeric;
                      }
                      return next;
                    });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            {JKK_RISK_CLASSES.map((risk) => (
              <label className="block" key={risk}>
                <span className="lbl">JKK {jkkRiskClassLabel(risk)} (%)</span>
                <input
                  type="number"
                  className="inp"
                  min={0}
                  step="0.01"
                  value={settings.jkkRiskRates[risk]}
                  disabled={saving}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      jkkRiskRates: {
                        ...current.jkkRiskRates,
                        [risk]: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="text-[11px] sub mt-3">
            Catatan: {settings.sourceNotes.bpjs} {settings.sourceNotes.jp}
          </div>
        </FormSection>

        <FormSection
          icon="clock"
          title="Upah Lembur, Alfa, dan Keterlambatan"
          description="Pembagi dan opsi potongan yang dipakai run payroll."
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["overtimeDivisor", "Pembagi lembur", settings.overtimeDivisor],
              ["alfaDivisor", "Pembagi alfa (hari)", settings.alfaDivisor],
              ["biayaJabatan.rate", "Biaya jabatan (%)", settings.biayaJabatan.rate],
              ["biayaJabatan.maxMonthly", "Maks biaya/bulan", settings.biayaJabatan.maxMonthly],
              ["biayaJabatan.maxYearly", "Maks biaya/tahun", settings.biayaJabatan.maxYearly],
            ].map(([key, label, value]) => (
              <label className="block" key={String(key)}>
                <span className="lbl">{label}</span>
                <input
                  type="number"
                  className="inp"
                  min={0}
                  value={Number(value)}
                  disabled={saving}
                  onChange={(event) => {
                    const numeric = Number(event.target.value);
                    setSettings((current) => {
                      const next = structuredClone(current);
                      const parts = String(key).split(".");
                      if (parts.length === 1) {
                        (next as unknown as Record<string, unknown>)[parts[0]] = numeric;
                      } else {
                        (next as unknown as Record<string, Record<string, number>>)[parts[0]][parts[1]] = numeric;
                      }
                      return next;
                    });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={settings.lateDeduction.enabled}
                disabled={saving}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    lateDeduction: {
                      ...current.lateDeduction,
                      enabled: event.target.checked,
                    },
                  }))
                }
              />
              Aktifkan potongan keterlambatan
            </label>
            <label>
              <span className="lbl">Nilai potongan</span>
              <input
                type="number"
                className="inp !w-40"
                min={0}
                value={settings.lateDeduction.amount}
                disabled={saving}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    lateDeduction: {
                      ...current.lateDeduction,
                      amount: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <label>
              <span className="lbl">Satuan</span>
              <select
                className="inp !w-auto"
                value={settings.lateDeduction.mode}
                disabled={saving}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    lateDeduction: {
                      ...current.lateDeduction,
                      mode: event.target.value as "per_minute" | "per_event",
                    },
                  }))
                }
              >
                <option value="per_minute">Per menit</option>
                <option value="per_event">Per kejadian</option>
              </select>
            </label>
            <label>
              <span className="lbl">Basis menit</span>
              <select
                className="inp !w-auto"
                value={settings.lateDeduction.basis}
                disabled={saving}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    lateDeduction: {
                      ...current.lateDeduction,
                      basis: event.target.value as "tolerance" | "start_time",
                    },
                  }))
                }
              >
                <option value="tolerance">Dari batas toleransi</option>
                <option value="start_time">Dari jam masuk</option>
              </select>
            </label>
          </div>
        </FormSection>

        <FormSection
          icon="cal"
          title="PTKP dan Pasal 17"
          description="Tarif progresif tahunan dipakai pada masa pajak Desember."
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PTKP_STATUSES.map((status) => (
              <label className="block" key={status}>
                <span className="lbl">{status}</span>
                <input
                  type="number"
                  className="inp"
                  min={0}
                  value={settings.ptkpTable[status]}
                  disabled={saving}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      ptkpTable: {
                        ...current.ptkpTable,
                        [status]: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {settings.progressiveBrackets.map((bracket, index) => (
              <div className="grid grid-cols-2 gap-2" key={index}>
                <label>
                  <span className="lbl">
                    Batas atas lapisan {index + 1}
                  </span>
                  <input
                    type="number"
                    className="inp"
                    min={0}
                    placeholder="Kosong = tanpa batas"
                    value={bracket.upTo ?? ""}
                    disabled={saving}
                    onChange={(event) =>
                      setSettings((current) => {
                        const next = structuredClone(current);
                        next.progressiveBrackets[index].upTo =
                          event.target.value === ""
                            ? null
                            : Number(event.target.value);
                        return next;
                      })
                    }
                  />
                </label>
                <label>
                  <span className="lbl">Tarif (%)</span>
                  <input
                    type="number"
                    className="inp"
                    min={0}
                    value={bracket.rate}
                    disabled={saving}
                    onChange={(event) =>
                      setSettings((current) => {
                        const next = structuredClone(current);
                        next.progressiveBrackets[index].rate = Number(
                          event.target.value
                        );
                        return next;
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="text-[11px] sub mt-3">
            {settings.sourceNotes.ter} Pemetaan kategori:{" "}
            {PTKP_STATUSES.map(
              (status) =>
                `${status}=${settings.terCategoryMap[status]}`
            ).join(", ")}
            .
          </div>
        </FormSection>

        <FormSection
          icon="file"
          title="Tabel TER"
          description="Dibaca dari database; sumber resmi dan jumlah lapisan."
        >
          <div className="flex flex-wrap gap-2">
            <span className="tag t-info">A · {importCount("A")} lapisan</span>
            <span className="tag t-info">B · {importCount("B")} lapisan</span>
            <span className="tag t-info">C · {importCount("C")} lapisan</span>
          </div>
          <div className="text-[11px] sub mt-3">
            {settings.sourceNotes.ter} Data seed mengikuti Lampiran PMK 168
            Tahun 2023. Tarif TER tidak diubah dari layar ini; perubahan
            kebijakan pajak harus melalui migrasi data resmi.
          </div>
        </FormSection>

        {initialData.history.length > 0 && (
          <FormSection
            icon="clock"
            title="Riwayat Perubahan"
            description="Perubahan pengaturan terakhir."
          >
            <div className="flex flex-col gap-2">
              {initialData.history.slice(0, 8).map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl text-[12px]"
                  style={{ background: "#FAF7F5" }}
                >
                  <div className="font-semibold">
                    Berlaku {entry.effectiveDate}
                  </div>
                  <div className="sub">
                    {formatDateTimeID(entry.changedAt)} ·{" "}
                    {entry.changedByName} · {entry.reason}
                  </div>
                </div>
              ))}
            </div>
          </FormSection>
        )}
      </div>
    </>
  );
}
