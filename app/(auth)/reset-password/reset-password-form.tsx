"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const MIN_PASSWORD = 8;

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Kata sandi minimal ${MIN_PASSWORD} karakter.`);
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(
        "Tautan reset tidak valid atau kedaluwarsa. Minta tautan baru dari administrator."
      );
      return;
    }

    setDone(true);
    setTimeout(() => {
      router.replace("/login");
      router.refresh();
    }, 1200);
  };

  if (done) {
    return (
      <div
        className="p-4 rounded-xl text-[13px]"
        style={{ background: "var(--okb, #EAF7EF)", color: "var(--ok, #1E7A46)" }}
      >
        Kata sandi berhasil diperbarui. Mengalihkan ke halaman masuk…
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error && (
        <div
          className="p-3 rounded-xl text-[12px]"
          style={{ background: "var(--badb)", color: "var(--bad)" }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div>
        <label className="lbl" htmlFor="new-password">
          Kata sandi baru
        </label>
        <div className="relative">
          <input
            id="new-password"
            className="inp pr-24"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold px-2 py-1"
            style={{ color: "var(--pink)" }}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? "Sembunyikan" : "Tampilkan"}
          </button>
        </div>
      </div>

      <div>
        <label className="lbl" htmlFor="confirm-password">
          Ulangi kata sandi
        </label>
        <input
          id="confirm-password"
          className="inp"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={loading}
        />
      </div>

      <button className="btn btn-p w-full justify-center" type="submit" disabled={loading}>
        {loading ? "Menyimpan…" : "Simpan kata sandi"}
      </button>

      <Link className="text-[12px] sub underline" href="/login">
        Kembali ke halaman masuk
      </Link>
    </form>
  );
}
