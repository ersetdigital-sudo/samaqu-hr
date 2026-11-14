"use client";

import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { formatDateID, formatMonthYearID } from "@/lib/datetime";
import { formatRupiah, formatPayrollHours } from "@/lib/payroll/rules";
import type { Payslip } from "@/lib/payroll/types";
import styles from "./payslip.module.css";

export function PayslipView({
  payslip,
  backHref,
  backLabel = "Kembali",
}: {
  payslip: Payslip;
  backHref: string;
  backLabel?: string;
}) {
  const calc = payslip.calculation;
  return (
    <>
      <PageHead
        title="Slip Gaji"
        subtitle={`${formatMonthYearID(payslip.periodMonth + "-01")} · ${payslip.employee.name}`}
      >
        <Link className="btn btn-g" href={backHref}>
          {backLabel}
        </Link>
        <button
          type="button"
          className="btn btn-p"
          onClick={() => window.print()}
        >
          Cetak / Simpan PDF
        </button>
      </PageHead>

      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <div className={styles.brand}>SAMAQU HRIS</div>
            <div className={styles.brandSub}>Slip Gaji Karyawan</div>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-bold">
              {formatMonthYearID(payslip.periodMonth + "-01")}
            </div>
            <div className="text-[11px] sub">
              Status: {payslip.status}
            </div>
            {payslip.paidDate && (
              <div className="text-[11px] sub">
                Dibayar {formatDateID(payslip.paidDate)}
              </div>
            )}
          </div>
        </div>

        <div className={`${styles.grid} ${styles.section}`}>
          <div>
            <div className="text-[11px] sub">Nama Karyawan</div>
            <div className="text-[13px] font-semibold">
              {payslip.employee.name}
            </div>
            <div className="text-[11px] sub">{payslip.employee.id}</div>
          </div>
          <div>
            <div className="text-[11px] sub">Departemen / Jabatan</div>
            <div className="text-[13px] font-semibold">
              {payslip.employee.department}
            </div>
            <div className="text-[11px] sub">{payslip.employee.position}</div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Pendapatan</div>
          {calc.incomeLines.length === 0 ? (
            <div className={styles.line}>
              <span>Tidak ada pendapatan</span>
              <span>{formatRupiah(0)}</span>
            </div>
          ) : (
            calc.incomeLines.map((line, index) => (
              <div className={styles.line} key={`${line.label}-${index}`}>
                <span>{line.label}</span>
                <span>{formatRupiah(line.amount)}</span>
              </div>
            ))
          )}
          <div className={`${styles.line} ${styles.total}`}>
            <span>Total Pendapatan</span>
            <span>{formatRupiah(calc.grossIncome)}</span>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Potongan</div>
          {calc.deductionLines.length === 0 ? (
            <div className={styles.line}>
              <span>Tidak ada potongan</span>
              <span>{formatRupiah(0)}</span>
            </div>
          ) : (
            calc.deductionLines.map((line, index) => (
              <div className={styles.line} key={`${line.label}-${index}`}>
                <span>{line.label}</span>
                <span>{formatRupiah(line.amount)}</span>
              </div>
            ))
          )}
          <div className={`${styles.line} ${styles.total}`}>
            <span>Take Home Pay</span>
            <span>{formatRupiah(calc.takeHomePay)}</span>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Rincian Perhitungan</div>
          <div className={styles.line}>
            <span>Hari kerja / alfa</span>
            <span>
              {calc.workdays} hari / {calc.alfaDays} alfa
            </span>
          </div>
          <div className={styles.line}>
            <span>Lembur ekuivalen</span>
            <span>{formatPayrollHours(calc.overtimeHours)}</span>
          </div>
          <div className={styles.line}>
            <span>Metode PPh 21</span>
            <span>
              {calc.pphMethod}
              {calc.pphTerCategory
                ? ` · ${calc.pphTerCategory} · ${calc.pphTerRate ?? 0}%`
                : ""}
            </span>
          </div>
          <div className={styles.line}>
            <span>BPJS karyawan (Kesehatan + JHT + JP)</span>
            <span>{formatRupiah(calc.employeeBpjsTotal)}</span>
          </div>
        </div>

        <div className={styles.note}>
          Slip ini dihasilkan dari snapshot payroll yang sudah Final/Dibayar.
          Nominal PPh dan BPJS mengikuti tarif yang berlaku saat run dihitung.
          Kontribusi perusahaan tidak mengurangi take home pay.
        </div>
      </div>
    </>
  );
}
