import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuthUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getAuthUser();
  if (user) redirect("/");

  const { error } = await searchParams;
  const linkError = error === "link";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div
        className="hidden lg:flex flex-col justify-between p-12 text-white"
        style={{
          background: "linear-gradient(150deg,#2B2523 0%,#4A3F3B 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl grid place-items-center font-extrabold"
            style={{ background: "var(--pink)" }}
          >
            S
          </div>
          <div>
            <div className="font-extrabold text-[19px] leading-none">
              SAMAQU
            </div>
            <div className="text-[10px] font-semibold tracking-widest mt-1 opacity-70">
              HRIS
            </div>
          </div>
        </div>

        <div className="max-w-[420px]">
          <div className="text-[30px] font-bold leading-tight">
            Satu sistem untuk seluruh pengelolaan SDM.
          </div>
          <p className="mt-4 text-[14px] leading-relaxed opacity-80">
            Karyawan, kontrak, dan rekrutmen dalam satu aplikasi internal yang
            aman, dengan pembelajaran di Samaqu Academy.
          </p>
        </div>

        <div className="text-[12px] opacity-60">
          Akses hanya untuk akun internal yang diberikan administrator.
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div
              className="w-9 h-9 rounded-lg grid place-items-center text-white font-extrabold"
              style={{ background: "var(--pink)" }}
            >
              S
            </div>
            <div className="font-extrabold tracking-tight">SAMAQU HRIS</div>
          </div>

          <div className="h1 text-[26px]">Masuk ke HRIS</div>
          <div className="sub mt-1 mb-6">
            Gunakan akun internal yang diberikan administrator.
          </div>

          {linkError && (
            <div
              className="p-3 rounded-xl text-[12px] mb-5"
              style={{ background: "var(--badb)", color: "var(--bad)" }}
              role="alert"
            >
              Tautan reset kata sandi tidak valid atau sudah kedaluwarsa.{" "}
              <Link className="font-semibold underline" href="/forgot-password">
                Minta tautan baru
              </Link>
              .
            </div>
          )}

          <Suspense fallback={<div className="sub text-[13px]">Memuat…</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
