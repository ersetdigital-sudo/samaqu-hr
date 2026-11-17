"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { NotificationItem } from "@/lib/notifications/types";

const POLL_MS = 120_000;

export function NotificationBell({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as {
        items?: NotificationItem[];
        error?: string;
      } | null;
      if (!response.ok || !body?.items) {
        throw new Error(body?.error ?? "Gagal memuat notifikasi");
      }
      setItems(body.items);
      setError("");
    } catch (cause) {
      if (!silent) {
        setError(
          cause instanceof Error ? cause.message : "Gagal memuat notifikasi"
        );
      }
    } finally {
      setLoaded(true);
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
    const onPointer = (event: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, load]);

  const total = items.reduce((sum, item) => sum + item.itemCount, 0);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        className="btn btn-g !px-2.5 !py-1.5 relative"
        aria-label={
          total > 0 ? `Notifikasi, ${total} item perlu perhatian` : "Notifikasi"
        }
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="bell" />
        {total > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: "var(--pink)", color: "white" }}
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-panel"
          className="card absolute right-0 mt-2 z-50 w-[360px] max-w-[calc(100vw-24px)] p-0 overflow-hidden shadow-lg"
        >
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 border-b"
            style={{ borderColor: "var(--line)" }}
          >
            <div>
              <div className="font-bold text-[14px]">Notifikasi</div>
              <div className="text-[11px] sub">
                {total > 0
                  ? `${total} item perlu perhatian`
                  : "Tidak ada yang perlu perhatian"}
              </div>
            </div>
            {canManage && (
              <Link
                className="text-[11px] font-semibold underline"
                href="/settings/notifikasi"
                onClick={() => setOpen(false)}
              >
                Pengaturan
              </Link>
            )}
          </div>

          <div className="max-h-[min(420px,60vh)] overflow-y-auto">
            {loading && !loaded ? (
              <div className="flex flex-col gap-2 p-4">
                {[0, 1, 2].map((item) => (
                  <div
                    className="h-12 rounded-lg animate-pulse"
                    style={{ background: "var(--line)" }}
                    key={item}
                  />
                ))}
              </div>
            ) : error ? (
              <div className="p-4 text-[12px]">
                <div style={{ color: "var(--bad)" }}>{error}</div>
                <button
                  type="button"
                  className="btn btn-g !py-1 !px-3 !text-[11px] mt-3"
                  onClick={() => void load()}
                >
                  Coba lagi
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center">
                <div className="font-semibold text-[13px]">
                  Tidak ada yang perlu perhatian
                </div>
                <div className="text-[11px] sub mt-1">
                  Notifikasi akan muncul saat ada tindakan yang diperlukan.
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {items.map((item) => (
                  <Link
                    className="px-4 py-3 border-b hover:bg-[#F8F5F2]"
                    style={{ borderColor: "var(--line)" }}
                    href={item.href}
                    key={item.category}
                    onClick={() => setOpen(false)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[12px]">
                          {item.title}
                        </div>
                        <div className="text-[11px] sub mt-0.5">
                          {item.detail}
                        </div>
                      </div>
                      <span className="tag t-mute shrink-0">
                        {item.itemCount}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
