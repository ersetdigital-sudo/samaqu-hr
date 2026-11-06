import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-[420px] p-7">
        <div className="h1 text-[22px]">Buat kata sandi baru</div>
        <div className="sub mt-1 mb-6">
          Kata sandi minimal 8 karakter. Gunakan kombinasi huruf dan angka.
        </div>

        <ResetPasswordForm />
      </div>
    </div>
  );
}
