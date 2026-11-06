import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-[480px] p-8">
        <span className="tag t-bad">Akses ditolak</span>
        <div className="h1 mt-4 text-[22px]">
          Akun Anda belum memiliki akses ke halaman ini
        </div>
        <div className="sub mt-2">
          Role yang diberikan tidak mencakup modul tersebut, atau akun Anda belum
          diaktifkan oleh administrator. Hubungi administrator HRIS untuk meminta
          akses.
        </div>

        <div className="flex flex-wrap gap-2 mt-6">
          <Link className="btn btn-p" href="/">
            Kembali ke Dashboard
          </Link>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
