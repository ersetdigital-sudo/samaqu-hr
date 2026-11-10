"use client";

import { useEffect, useRef } from "react";
import { useRecruitment } from "@/components/recruitment-provider";

/**
 * Toast dirender sebagai popover agar ikut masuk top layer browser.
 * Modal memakai <dialog showModal()> yang berada di atas semua z-index biasa,
 * jadi toast biasa akan tertutup backdrop dialog.
 */
export function Toast() {
  const { toastMsg, toastOn } = useRecruitment();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof element.showPopover !== "function") return;

    if (toastOn) {
      if (!element.matches(":popover-open")) element.showPopover();
      return;
    }

    if (!element.matches(":popover-open")) return;
    const timer = setTimeout(() => {
      if (element.isConnected && element.matches(":popover-open"))
        element.hidePopover();
    }, 250);
    return () => clearTimeout(timer);
  }, [toastOn]);

  return (
    <div
      ref={ref}
      id="toast"
      popover="manual"
      role="status"
      className={`toast ${toastOn ? "show" : ""}`}
    >
      {toastMsg}
    </div>
  );
}
