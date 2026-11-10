import { SignOutButton } from "@/components/auth/sign-out-button";

export default function AccountInactivePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-[480px] p-8">
        <span className="tag t-warn">Akun belum aktif</span>
        <div className="h1 mt-4 text-[22px]">
          Akun kamu belum bisa masuk
        </div>
        <div className="sub mt-2">
          Akun kamu belum aktif atau dinonaktifkan, atau belum memiliki peran
          akses. Hubungi admin untuk mengaktifkan kembali aksesnya.
        </div>
        <div className="sub mt-2">
          Jika kamu baru menerima undangan, pastikan kata sandi sudah dibuat
          lalu masuk kembali. Setelah login pertama, akun aktif otomatis.
        </div>

        <div className="flex flex-wrap gap-2 mt-6">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
