import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { formatDateID, formatMonthYearID } from "@/lib/datetime";
import { formatRupiah } from "@/lib/payroll/rules";
import type { MyPayslipListItem } from "@/lib/payroll/types";

export function MyPayslipsView({
  payslips,
}: {
  payslips: MyPayslipListItem[];
}) {
  return (
    <>
      <PageHead
        title="Slip Gaji"
        subtitle="Slip gaji Final dan Dibayar milikmu. Dapat dicetak atau disimpan sebagai PDF."
      />

      {payslips.length === 0 ? (
        <div className="card p-8 text-center max-w-[640px]">
          <div className="font-semibold text-[15px]">Belum ada slip gaji</div>
          <div className="sub text-[13px] mt-2">
            Slip akan muncul di sini setelah payroll difinalisasi HR.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-[760px]">
          {payslips.map((slip) => (
            <Link
              key={slip.runId}
              href={`/slip-gaji/${slip.runId}`}
              className="card p-5 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <div className="font-bold">
                  {formatMonthYearID(slip.periodMonth)}
                </div>
                <div className="text-[11px] sub">
                  {slip.status}
                  {slip.paidDate
                    ? ` · dibayar ${formatDateID(slip.paidDate)}`
                    : slip.finalizedAt
                      ? ` · final ${formatDateID(slip.finalizedAt)}`
                      : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] sub">Take Home Pay</div>
                <div className="text-[18px] font-bold">
                  {formatRupiah(slip.takeHomePay)}
                </div>
              </div>
              <span className="tag t-info">Lihat slip</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
