"use client";

import { formatMonthYearID } from "@/lib/datetime";

export function MonthNavigation({
  month,
  disableNext,
  onChange,
}: {
  month: string;
  disableNext: boolean;
  onChange: (delta: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        className="btn btn-g !py-1.5 !px-3"
        onClick={() => onChange(-1)}
        aria-label="Bulan sebelumnya"
      >
        ‹
      </button>
      <span className="text-[13px] font-semibold">
        {formatMonthYearID(`${month}-01`)}
      </span>
      <button
        type="button"
        className="btn btn-g !py-1.5 !px-3"
        onClick={() => onChange(1)}
        disabled={disableNext}
        aria-label="Bulan berikutnya"
      >
        ›
      </button>
    </div>
  );
}
