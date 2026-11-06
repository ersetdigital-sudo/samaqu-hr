"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email wajib diisi.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserSupabase();
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });
    setLoading(false);
    // Selalu tampilkan hasil yang sama agar tidak membocorkan keberadaan akun.
    setSent(true);
  };

  if (sent) {
    return (
      <div
        className="p-4 rounded-xl text-[13px]"
        style={{ background: "var(--okb, #EAF7EF)", color: "var(--ok, #1E7A46)" }}
      >
        Jika email tersebut terdaftar, tautan reset kata sandi sudah dikirim.
        Periksa kotak masuk Anda.
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
        <label className="lbl" htmlFor="reset-email">
          Email
        </label>
        <input
          id="reset-email"
          className="inp"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
        />
      </div>

      <button className="btn btn-p w-full justify-center" type="submit" disabled={loading}>
        {loading ? "Mengirim…" : "Kirim tautan reset"}
      </button>
    </form>
  );
}
