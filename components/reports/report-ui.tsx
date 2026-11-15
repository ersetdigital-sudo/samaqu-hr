"use client";

import type { ReactNode } from "react";

export function ReportMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="text-[11px] sub font-semibold">{label}</div>
      <div className="text-[20px] font-bold tracking-tight mt-1 break-words">
        {value}
      </div>
      {hint && <div className="text-[11px] sub mt-1">{hint}</div>}
    </div>
  );
}

export function ReportEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <div className="font-semibold text-[15px]">Belum ada data</div>
      <div className="sub text-[13px] mt-2">{children}</div>
    </div>
  );
}
