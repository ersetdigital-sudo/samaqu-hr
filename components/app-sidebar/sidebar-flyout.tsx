"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  isSubItemLive,
  type NavModule,
  type NavSubItem,
} from "@/lib/navigation";
import styles from "./sidebar.module.css";

type Position = { top: number; left: number; maxHeight: number };

export function SidebarFlyout({
  id,
  module,
  items,
  anchor,
  onClose,
  onPointerEnter,
  onPointerLeave,
}: {
  id: string;
  module: NavModule;
  items: NavSubItem[];
  anchor: HTMLElement;
  onClose: (restoreFocus?: boolean) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const pathname = usePathname();
  const panel = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const top = Math.max(12, Math.min(rect.top, window.innerHeight - 80));
      setPosition({
        top,
        left: rect.right + 10,
        maxHeight: Math.max(120, window.innerHeight - top - 16),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose(true);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || anchor.contains(target)) return;
      onClose(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchor, onClose]);

  function onPanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const links = Array.from(
      panel.current?.querySelectorAll<HTMLElement>("a[href]") ?? [],
    );
    if (!links.length) return;
    event.preventDefault();
    const current = links.indexOf(document.activeElement as HTMLElement);
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? links.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % links.length
            : (current - 1 + links.length) % links.length;
    links[index]?.focus();
  }

  return (
    <nav
      ref={panel}
      id={id}
      className={styles.flyout}
      aria-label={`Submenu ${module.label}`}
      style={
        position
          ? {
              top: position.top,
              left: position.left,
              maxHeight: position.maxHeight,
            }
          : { visibility: "hidden" }
      }
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onKeyDown={onPanelKeyDown}
    >
      <p className={styles.flyoutTitle}>{module.label}</p>
      <div className={styles.flyoutItems}>
        {items.map((item) =>
          isSubItemLive(module, item) ? (
            <Link
              key={item.id}
              href={item.href}
              prefetch={false}
              className={pathname === item.href ? styles.flyoutActive : ""}
              aria-current={pathname === item.href ? "page" : undefined}
              onClick={() => onClose(false)}
            >
              {item.label}
            </Link>
          ) : (
            <span key={item.id} className={styles.flyoutSoon}>
              <span>{item.label}</span>
              <em>Segera</em>
            </span>
          ),
        )}
      </div>
    </nav>
  );
}
