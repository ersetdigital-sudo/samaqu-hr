"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./form-drawer.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Cangkang drawer form reusable: header tetap, isi scroll, footer tetap.
 * Konfirmasi perubahan belum disimpan dan validasi tetap tanggung jawab form.
 */
export function FormDrawer({
  open,
  title,
  description,
  busy = false,
  onRequestClose,
  footer,
  footerStatus,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  busy?: boolean;
  onRequestClose: () => void;
  footer: ReactNode;
  footerStatus?: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => panelRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = originalOverflow;
      const previous = previousFocusRef.current;
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Dialog konfirmasi/bawaan browser memakai top layer dan mengelola
      // fokusnya sendiri; jangan bentrok dengan trap drawer.
      if (document.querySelector("dialog[open]")) return;

      if (event.key === "Escape") {
        if (busy) return;
        event.preventDefault();
        onRequestClose();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter(
        (element) =>
          element.offsetParent !== null || element === document.activeElement
      );

      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (
          active === first ||
          active === panel ||
          !active ||
          !panel.contains(active)
        ) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !active || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, busy, onRequestClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation">
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <div className="min-w-0">
            <div className={styles.headerTitle} id={titleId}>
              {title}
            </div>
            {description && (
              <div className={styles.headerDescription} id={descriptionId}>
                {description}
              </div>
            )}
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onRequestClose}
            disabled={busy}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>{children}</div>
        <div className={styles.footer}>
          <div className={styles.footerStatus}>{footerStatus}</div>
          <div className={styles.footerActions}>{footer}</div>
        </div>
      </div>
    </div>
  );
}
