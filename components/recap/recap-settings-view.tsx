"use client";

import { useState } from "react";
import { PageHead } from "@/components/page-head";
import { useRecruitment } from "@/components/recruitment-provider";
import { formatDateID, formatDateTimeID } from "@/lib/datetime";
import { resolveRecapPeriod } from "@/lib/recap/rules";
import type { RecapSettings } from "@/lib/recap/types";

export function RecapSettingsView({
  initialSettings,
  todayIso,
}: {
  initialSettings: RecapSettings;
  todayIso: string;
}) {
  const { toast } = useRecruitment();
  const [settings, setSettings] = useState(initialSettings);
  const [startDay, setStartDay] = useState(initialSettings.periodStartDay);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const currentMonth = todayIso.slice(0, 7);
  const preview = resolveRecapPeriod(
    currentMonth,
    Number.isInteger(startDay) ? startDay : 1
  );
  const dirty = startDay !== settings.periodStartDay;

  const save = async () => {
    setError("");
    setMessage("");
    if (!Number.isInteger(startDay) || startDay < 1 || startDay > 28) {
      setError("Tanggal mulai periode harus 1–28.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/recap/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStartDay: startDay }),
      });
      const body = (await response.json().catch(() => null)) as {
        settings?: RecapSettings;
        error?: string;
      } | null;
      if (!response.ok || !body?.settings) {
        throw new Error(body?.error ?? "Gagal menyimpan pengaturan");
      }
      setSettings(body.settings);
      setStartDay(body.settings.periodStartDay);
      setMessage("Periode rekap berhasil diperbarui.");
      toast("Pengaturan periode rekap diperbarui");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan pengaturan"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead
        title="Pengaturan Umum"
        subtitle="Pengaturan global yang dipakai modul HRIS."
      />

      <div className="card p-5 sm:p-6 max-w-[760px]">
        <div className="font-bold">Periode Rekap Kehadiran</div>
        <div className="text-[12px] sub mt-1">
          Tentukan tanggal mulai periode rekap bulanan. Tanggal 1 berarti awal
          bulan sampai akhir bulan. Contoh 26 berarti tanggal 26 bulan lalu
          sampai tanggal 25 bulan berjalan.
        </div>

        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="lbl" htmlFor="recap-start-day">
            Tanggal mulai periode
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="recap-start-day"
              type="number"
              min={1}
              max={28}
              className="inp !w-28"
              value={startDay}
              disabled={saving}
              onChange={(event) => {
                setStartDay(Number(event.target.value));
                setError("");
                setMessage("");
              }}
            />
            <span className="text-[12px] sub">tanggal 1–28</span>
          </div>

          <div
            className="mt-4 p-3 rounded-xl text-[12px]"
            style={{ background: "#FAF7F5" }}
          >
            <div className="font-semibold">Pratinjau periode bulan ini</div>
            <div className="sub mt-1">
              {formatDateID(preview.from)} – {formatDateID(preview.to)}
            </div>
          </div>

          {error && (
            <div className="tag t-bad w-full justify-center mt-4">{error}</div>
          )}
          {message && (
            <div className="tag t-ok w-full justify-center mt-4">{message}</div>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              type="submit"
              className="btn btn-p"
              disabled={saving || !dirty}
            >
              {saving ? "Menyimpan…" : "Simpan Pengaturan"}
            </button>
            {dirty && (
              <button
                type="button"
                className="btn btn-g"
                disabled={saving}
                onClick={() => {
                  setStartDay(settings.periodStartDay);
                  setError("");
                  setMessage("");
                }}
              >
                Batal
              </button>
            )}
          </div>
        </form>

        <div className="text-[11px] sub mt-5">
          {settings.updatedAt
            ? `Terakhir diubah oleh ${settings.updatedByName ?? "HR"} pada ${formatDateTimeID(
                settings.updatedAt
              )}.`
            : "Belum pernah diubah."}
        </div>
      </div>

      <div
        className="card p-5 sm:p-6 max-w-[760px] mt-5 text-[12px] sub"
      >
        Rekap kehadiran tidak menyimpan angka mati. Setiap kali dibuka atau
        diekspor, nilainya dihitung ulang dari kehadiran, cuti yang disetujui,
        jadwal kerja, dan kalender libur terbaru. Koreksi tetap dilakukan lewat
        Kehadiran Harian.
      </div>
    </>
  );
}
