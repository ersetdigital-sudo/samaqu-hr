"use client";

import { useRecruitment } from "@/components/recruitment-provider";

export function Toast() {
  const { toastMsg, toastOn } = useRecruitment();

  return (
    <div className={`toast ${toastOn ? "show" : ""}`} id="toast">
      {toastMsg}
    </div>
  );
}
