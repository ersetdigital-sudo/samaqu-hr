"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { DRAWER_SIZE_CLASS, type DrawerSize } from "./drawer-sizes";
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
  size = "md",
  modal = true,
  busy = false,
  onRequestClose,
  footer,
  footerStatus,
  subnav,
  bodyRef,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  size?: DrawerSize;
  /** Mode form: backdrop, scroll lock, dan focus trap. Detail memakai false. */
  modal?: boolean;
  busy?: boolean;
  onRequestClose: () => void;
  footer?: ReactNode;
  footerStatus?: ReactNode;
  /** Baris navigasi seksi yang menempel di bawah header. */
  subnav?: ReactNode;
  /** Ref ke area isi yang bisa di-scroll (dipakai navigasi seksi). */
  bodyRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = modal ? document.body.style.overflow : null;
    if (modal) document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => panelRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      if (originalOverflow !== null) {
        document.body.style.overflow = originalOverflow;
      }
      const previous = previousFocusRef.current;
      if (previous?.isConnected) previous.focus();
    };
  }, [open, modal]);

  useEffect(() => {
    if (!open || !modal) return;

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

  const panel = (
      <div
        ref={panelRef}
        className={`${styles.panel} ${DRAWER_SIZE_CLASS[size]}`}
        role="dialog"
        aria-modal={modal ? "true" : undefined}
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

        {subnav && <div className={styles.subnav}>{subnav}</div>}

        <div className={styles.body} ref={bodyRef}>
          {children}
        </div>
        {(footer || footerStatus) && (
          <div className={styles.footer}>
            <div className={styles.footerStatus}>{footerStatus}</div>
            <div className={styles.footerActions}>{footer}</div>
          </div>
        )}
      </div>
  );

  if (!modal) {
    return (
      <div className={styles.standalone}>
        {panel}
      </div>
    );
  }

  return (
    <div className={styles.overlay} role="presentation">
      {panel}
    </div>
  );
}
