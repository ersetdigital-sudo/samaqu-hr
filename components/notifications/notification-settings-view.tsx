"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import type { NotificationSettingsItem } from "@/lib/notifications/types";

export function NotificationSettingsView({
  initialCategories,
}: {
  initialCategories: NotificationSettingsItem[];
}) {
  const { toast } = useRecruitment();
  const [categories, setCategories] = useState(initialCategories);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/settings/notifications", {
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as {
      categories?: NotificationSettingsItem[];
      error?: string;
    } | null;
    if (!response.ok || !body?.categories) {
      throw new Error(body?.error ?? "Gagal memuat pengaturan notifikasi");
    }
    setCategories(body.categories);
  }, []);

  const toggle = async (item: NotificationSettingsItem) => {
    if (busy) return;
    const next = !item.enabled;
    setBusy(item.category);
    setError("");
    setCategories((current) =>
      current.map((row) =>
        row.category === item.category ? { ...row, enabled: next } : row
      )
    );
    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: item.category, enabled: next }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Gagal menyimpan preferensi");
      }
      toast(next ? "Kategori diaktifkan" : "Kategori dinonaktifkan");
    } catch (cause) {
      setCategories((current) =>
        current.map((row) =>
          row.category === item.category ? { ...row, enabled: !next } : row
        )
      );
      setError(
        cause instanceof Error ? cause.message : "Gagal menyimpan preferensi"
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHead
        title="Notifikasi"
        subtitle="Atur kategori notifikasi yang muncul di lonceng untuk akun ini."
      >
        <Link className="btn btn-g" href="/settings/umum">
          Kembali
        </Link>
        <button
          type="button"
          className="btn btn-g"
          onClick={() =>
            void refresh().catch((cause) =>
              toast(
                cause instanceof Error
                  ? cause.message
                  : "Gagal memuat pengaturan notifikasi"
              )
            )
          }
        >
          Muat ulang
        </button>
      </PageHead>

      <div className="card p-4 mb-4 text-[12px] sub">
        Default semua kategori aktif. Mematikan kategori hanya memengaruhi
        lonceng akun ini; data sumber dan halaman terkait tidak berubah.
      </div>

      {error && <div className="tag t-bad w-full justify-center mb-4">{error}</div>}

      <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
        {categories.length === 0 ? (
          <div className="p-6 text-center sub text-[13px]">
            Tidak ada kategori notifikasi untuk peran ini.
          </div>
        ) : (
          categories.map((item) => (
            <div
              className="flex items-center justify-between gap-4 p-4"
              style={{ borderColor: "var(--line)" }}
              key={item.category}
            >
              <div className="min-w-0">
                <div className="font-semibold text-[13px]">{item.label}</div>
                <div className="text-[11px] sub mt-0.5">
                  {item.description}
                </div>
                <div className="text-[11px] sub mt-1">
                  Saat ini: {item.itemCount} item
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={item.enabled}
                aria-label={`${item.enabled ? "Nonaktifkan" : "Aktifkan"} ${item.label}`}
                className="shrink-0 w-11 h-6 rounded-full relative transition-colors"
                style={{
                  background: item.enabled ? "var(--p)" : "var(--line)",
                  opacity: busy === item.category ? 0.6 : 1,
                }}
                disabled={busy === item.category}
                onClick={() => void toggle(item)}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ left: item.enabled ? 22 : 2 }}
                />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
