"use client";

import { useState } from "react";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoGrid, InfoItem } from "@/components/ui/detail-info";
import { FormSection } from "@/components/ui/form-section";
import { formatDateID } from "@/lib/datetime";
import { ini } from "@/lib/data";
import {
  formatPayrollHours,
  formatRupiah,
  payrollRunStatusTone,
} from "@/lib/payroll/rules";
import type {
  PayrollManualItem,
  PayrollRun,
  PayrollRunEmployee,
} from "@/lib/payroll/types";

export function PayrollRunEmployeeDrawer({
  employee,
  run,
  onClose,
  onMutated,
}: {
  employee: PayrollRunEmployee | null;
  run: PayrollRun;
  onClose: () => void;
  onMutated: (message: string) => void;
}) {
  const [category, setCategory] = useState<"Pendapatan" | "Potongan">(
    "Pendapatan"
  );
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!employee) return null;

  const calc = employee.calculation;

  const addItem = async () => {
    if (!label.trim() || !reason.trim() || amount <= 0) {
      setError("Label, nominal, dan alasan wajib diisi.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/payroll/runs/${run.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.employeeId,
          category,
          label: label.trim(),
          amount,
          reason: reason.trim(),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal menambah item");
      }
      setLabel("");
      setAmount(0);
      setReason("");
      onMutated("Item manual ditambahkan dan payroll dihitung ulang");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah item");
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (item: PayrollManualItem) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/payroll/runs/${run.id}/items/${item.id}`,
        { method: "DELETE" }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal menghapus item");
      }
      onMutated("Item manual dihapus dan payroll dihitung ulang");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus item");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailDrawer
      open={Boolean(employee)}
      title="Rincian Payroll Karyawan"
      description={`${formatDateID(run.periodMonth)} · ${employee.employeeName}`}
      size="md"
      onClose={onClose}
      footer={
        run.status === "Final" || run.status === "Dibayar" ? (
          <a
            className="btn btn-p"
            href={`/payroll/runs/${run.id}/slip/${employee.employeeId}`}
          >
            Buka Slip
          </a>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <FormSection
          icon="users"
          title="Karyawan"
          description="Snapshot identitas saat run dihitung."
        >
          <div className="flex items-center gap-4">
            <div className="av" style={{ width: 52, height: 52, fontSize: 17 }}>
              {ini(employee.employeeName)}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[17px]">
                {employee.employeeName}
              </div>
              <div className="sub text-[12px]">
                {employee.employeeId} · {employee.department}
              </div>
              <div className="sub text-[11px]">{employee.position}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className={`tag ${employee.calcStatus === "Lengkap" ? "t-ok" : "t-warn"}`}>
                  {employee.calcStatus}
                </span>
                <span className={`tag ${payrollRunStatusTone(run.status)}`}>
                  {run.status}
                </span>
              </div>
            </div>
          </div>
        </FormSection>

        {error && <div className="tag t-bad w-full justify-center">{error}</div>}

        {calc ? (
          <>
            <FormSection
              icon="wallet"
              title="Pendapatan"
              description="Gaji pokok dan tunjangan mengikuti proporsi hari kerja."
            >
              <InfoGrid>
                <InfoItem
                  label="Gaji pokok bulanan"
                  value={formatRupiah(calc.baseSalaryMonthly)}
                />
                <InfoItem
                  label="Faktor proporsi"
                  value={`${(calc.prorationFactor * 100).toFixed(1)}%`}
                />
                <InfoItem
                  label="Gaji pokok dihitung"
                  value={formatRupiah(calc.proratedBaseSalary)}
                />
                <InfoItem
                  label="Tunjangan tetap"
                  value={formatRupiah(calc.proratedFixedAllowance)}
                />
                <InfoItem
                  label="Tunjangan tidak tetap"
                  value={formatRupiah(calc.proratedVariableAllowance)}
                />
                <InfoItem
                  label="Hari kerja"
                  value={`${calc.workdays} dari ${calc.fullPeriodWorkdays}`}
                />
                <InfoItem
                  label="Lembur ekuivalen"
                  value={formatPayrollHours(calc.overtimeHours)}
                />
                <InfoItem
                  label="Upah lembur"
                  value={formatRupiah(calc.overtimePay)}
                />
                <InfoItem
                  label="Total pendapatan"
                  value={formatRupiah(calc.grossIncome)}
                  full
                />
              </InfoGrid>
              <div className="text-[11px] sub mt-2">
                Upah lembur = (gaji pokok + tunjangan tetap) /{" "}
                {calc.ratesSnapshot.overtimeDivisor} × jam ekuivalen. Hari kerja
                yang dipakai untuk proporsi: {calc.workdays}/
                {calc.fullPeriodWorkdays}.
              </div>
              {calc.incomeLines.length > 0 && (
                <div className="flex flex-col gap-1 mt-3 text-[12px]">
                  {calc.incomeLines.map((line, index) => (
                    <div
                      className="flex justify-between gap-3"
                      key={`${line.label}-${index}`}
                    >
                      <span className="sub">
                        {line.label}
                        {line.detail ? ` · ${line.detail}` : ""}
                      </span>
                      <b>{formatRupiah(line.amount)}</b>
                    </div>
                  ))}
                </div>
              )}
            </FormSection>

            <FormSection
              icon="file"
              title="Potongan & Pajak"
              description="Potongan karyawan dan biaya perusahaan dipisahkan."
            >
              <InfoGrid>
                <InfoItem
                  label="BPJS Kesehatan karyawan"
                  value={formatRupiah(calc.bpjsKesehatanEmployee)}
                />
                <InfoItem
                  label="JHT karyawan"
                  value={formatRupiah(calc.jhtEmployee)}
                />
                <InfoItem
                  label="JP karyawan"
                  value={formatRupiah(calc.jpEmployee)}
                />
                <InfoItem
                  label="Potongan alfa"
                  value={`${formatRupiah(calc.alfaDeduction)} (${calc.alfaDays} hari)`}
                />
                <InfoItem
                  label="Keterlambatan"
                  value={`${formatRupiah(calc.lateDeduction)} (${calc.lateCount}× / ${calc.lateMinutes} mnt)`}
                />
                <InfoItem
                  label="PPh 21"
                  value={`${formatRupiah(calc.pph21)} · ${calc.pphMethod}`}
                />
                <InfoItem
                  label="Kategori / tarif TER"
                  value={
                    calc.pphTerCategory
                      ? `${calc.pphTerCategory} · ${calc.pphTerRate ?? 0}%`
                      : "Pasal 17"
                  }
                />
                <InfoItem
                  label="Total potongan"
                  value={formatRupiah(calc.totalDeductions)}
                  full
                />
                <InfoItem
                  label="Take home pay"
                  value={formatRupiah(calc.takeHomePay)}
                  full
                />
              </InfoGrid>
              {calc.pphMethod === "Pasal 17" && (
                <div className="text-[11px] sub mt-2">
                  Bruto setahun {formatRupiah(calc.pphAnnualGross)} · biaya
                  jabatan {formatRupiah(calc.pphAnnualBiayaJabatan)} · PTKP{" "}
                  {formatRupiah(calc.pphAnnualPtkp)} · PKP{" "}
                  {formatRupiah(calc.pphAnnualPkp)} · PPh setahun{" "}
                  {formatRupiah(calc.pphAnnualTax)} · sudah dipotong{" "}
                  {formatRupiah(calc.pphPrior)}.
                </div>
              )}
              <div className="text-[11px] sub mt-2">
                Potongan alfa = gaji pokok dihitung /{" "}
                {calc.ratesSnapshot.alfaDivisor} × {calc.alfaDays} hari. Tarif
                BPJS: Kesehatan {calc.ratesSnapshot.bpjsKesehatan.employeeRate}%/
                {calc.ratesSnapshot.bpjsKesehatan.employerRate}% · JHT{" "}
                {calc.ratesSnapshot.jht.employeeRate}%/
                {calc.ratesSnapshot.jht.employerRate}% · JP{" "}
                {calc.ratesSnapshot.jp.employeeRate}%/
                {calc.ratesSnapshot.jp.employerRate}%.
              </div>
              {calc.warnings.length > 0 && (
                <div className="flex flex-col gap-1 mt-3">
                  {calc.warnings.map((warning) => (
                    <div className="text-[11px]" style={{ color: "var(--warn)" }} key={warning}>
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </FormSection>

            <FormSection
              icon="clock"
              title="Kontribusi Perusahaan"
              description="Tidak memotong take home pay."
            >
              <InfoGrid>
                <InfoItem label="BPJS Kesehatan" value={formatRupiah(calc.bpjsKesehatanEmployer)} />
                <InfoItem label="JHT" value={formatRupiah(calc.jhtEmployer)} />
                <InfoItem label="JP" value={formatRupiah(calc.jpEmployer)} />
                <InfoItem label="JKK" value={formatRupiah(calc.jkkEmployer)} />
                <InfoItem label="JKM" value={formatRupiah(calc.jkmEmployer)} />
                <InfoItem label="Total biaya perusahaan" value={formatRupiah(calc.employerCost)} full />
              </InfoGrid>
              <div className="text-[11px] sub mt-2">
                Tarif dasar: gaji pokok + tunjangan tetap. Pembagi lembur{" "}
                {calc.ratesSnapshot.overtimeDivisor}, pembagi alfa{" "}
                {calc.ratesSnapshot.alfaDivisor}.
              </div>
            </FormSection>
          </>
        ) : (
          <div className="text-[12px] sub">
            Perhitungan belum tersedia. Jalankan Hitung Ulang.
          </div>
        )}

        <FormSection
          icon="file"
          title="Item Manual"
          description="Pendapatan atau potongan tambahan khusus run ini."
        >
          {employee.items.length === 0 && (
            <div className="text-[12px] sub mb-2">Belum ada item manual.</div>
          )}
          <div className="flex flex-col gap-2">
            {employee.items.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl text-[12px]"
                style={{ background: "#FAF7F5" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {item.category === "Pendapatan" ? "+" : "−"}{" "}
                      {item.label} · {formatRupiah(item.amount)}
                    </div>
                    <div className="sub">{item.reason}</div>
                  </div>
                  {run.status === "Draft" && (
                    <button
                      type="button"
                      className="btn btn-g !py-1 !px-2 !text-[11px]"
                      style={{ color: "var(--bad)" }}
                      disabled={busy}
                      onClick={() => void deleteItem(item)}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {run.status === "Draft" && (
            <div className="flex flex-col gap-2 mt-4">
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="inp"
                  value={category}
                  disabled={busy}
                  onChange={(event) =>
                    setCategory(event.target.value as "Pendapatan" | "Potongan")
                  }
                >
                  <option value="Pendapatan">Pendapatan</option>
                  <option value="Potongan">Potongan</option>
                </select>
                <input
                  className="inp"
                  type="number"
                  min={1}
                  step="0.01"
                  placeholder="Nominal"
                  value={amount || ""}
                  disabled={busy}
                  onChange={(event) => setAmount(Number(event.target.value))}
                />
              </div>
              <input
                className="inp"
                placeholder="Label item"
                maxLength={150}
                value={label}
                disabled={busy}
                onChange={(event) => setLabel(event.target.value)}
              />
              <input
                className="inp"
                placeholder="Alasan wajib"
                maxLength={500}
                value={reason}
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
              />
              <button
                type="button"
                className="btn btn-g"
                onClick={() => void addItem()}
                disabled={busy || !label.trim() || !reason.trim() || amount <= 0}
              >
                {busy ? "Memproses…" : "Tambah Item"}
              </button>
            </div>
          )}
        </FormSection>
      </div>
    </DetailDrawer>
  );
}
