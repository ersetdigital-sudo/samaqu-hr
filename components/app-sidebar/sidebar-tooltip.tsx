"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import styles from "./sidebar.module.css";

type Position = { top: number; left: number };

export function SidebarTooltip({
  label,
  enabled,
  className = "",
  children,
}: {
  label: string;
  enabled: boolean;
  className?: string;
  children: ReactNode;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setPosition(null);
  }, [clearTimer]);

  const show = useCallback(() => {
    if (!enabled) return;
    clearTimer();
    timer.current = setTimeout(() => {
      const icon = host.current?.querySelector("svg");
      const rect = (icon ?? host.current)?.getBoundingClientRect();
      if (rect)
        setPosition({ top: rect.top + rect.height / 2, left: rect.right + 10 });
    }, 150);
  }, [clearTimer, enabled]);

  useEffect(() => {
    if (!enabled) hide();
  }, [enabled, hide]);

  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => hide();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [enabled, hide]);

  useEffect(() => clearTimer, [clearTimer]);

  return (
    <span
      ref={host}
      className={`${styles.tooltipHost} ${className}`.trim()}
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {enabled && position
        ? createPortal(
            <span
              className={styles.tooltip}
              style={{ top: position.top, left: position.left }}
              role="tooltip"
              aria-hidden="true"
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
