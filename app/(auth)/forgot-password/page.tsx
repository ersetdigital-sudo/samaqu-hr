import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-[420px] p-7">
        <div className="h1 text-[22px]">Lupa kata sandi</div>
        <div className="sub mt-1 mb-6">
          Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat kata
          sandi baru.
        </div>

        <ForgotPasswordForm />

        <div className="mt-6 text-[12px]">
          <Link className="sub underline" href="/login">
            Kembali ke halaman masuk
          </Link>
        </div>
      </div>
    </div>
  );
}
