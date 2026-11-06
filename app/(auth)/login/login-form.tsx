"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Email dan kata sandi wajib diisi.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setLoading(false);
      // Pesan generik: jangan bocorkan apakah email terdaftar.
      setError("Email atau kata sandi tidak sesuai.");
      return;
    }

    // Verifikasi status akun + role di server; akun nonaktif langsung ditolak.
    const check = await fetch("/api/auth/session", { method: "POST" });

    if (!check.ok) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        check.status === 403
          ? "Akun ini belum memiliki akses aktif. Hubungi administrator."
          : "Gagal memverifikasi sesi. Coba lagi."
      );
      return;
    }

    const next = searchParams?.get("next") ?? null;
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    router.replace(target);
    router.refresh();
  };

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
        <label className="lbl" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="inp"
          type="email"
          autoComplete="email"
          placeholder="nama@samaqu.co.id"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
        />
      </div>

      <div>
        <label className="lbl" htmlFor="password">
          Kata sandi
        </label>
        <div className="relative">
          <input
            id="password"
            className="inp pr-16"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold px-2 py-1 rounded-md"
            style={{ color: "var(--pink)" }}
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          >
            {showPassword ? "Sembunyikan" : "Tampilkan"}
          </button>
        </div>
      </div>

      <button className="btn btn-p w-full justify-center" type="submit" disabled={loading}>
        {loading ? "Memproses…" : "Masuk"}
      </button>

      <div className="flex items-center justify-between text-[12px]">
        <Link className="sub underline" href="/forgot-password">
          Lupa kata sandi?
        </Link>
        <span className="sub">Akun dibuat oleh administrator</span>
      </div>
    </form>
  );
}
