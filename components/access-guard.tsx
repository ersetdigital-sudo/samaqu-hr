"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  canAccess,
  findModuleByPath,
  findSubItem,
  subItemAllowed,
  type Role,
} from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/session";

/**
 * Penjaga akses level halaman.
 *
 * Role berasal dari sesi server (bukan konstanta). Server sudah memverifikasi
 * session; komponen ini mencegah render modul yang tidak diizinkan bila URL
 * diketik langsung.
 */
export function AccessGuard({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const module = findModuleByPath(pathname);
  const moduleAllowed = module ? canAccess(role, module) : true;
  const subItem = findSubItem(module, pathname);

  const allowed =
    !module || (moduleAllowed && subItemAllowed(role, module, pathname));

  if (allowed) {
    return <>{children}</>;
  }

  const pageTitle =
    module && moduleAllowed && subItem
      ? `Halaman ${subItem.label} dibatasi`
      : module
        ? `Modul ${module.label} dibatasi`
        : "Akses dibatasi";
  const scope = module && moduleAllowed && subItem ? "halaman" : "modul";

  return (
    <div className="card p-8 max-w-[560px]">
      <span className="tag t-bad">Akses ditolak</span>
      <div className="h1 mt-4 text-[20px]">{pageTitle}</div>
      <div className="sub mt-2">
        Role aktif Anda adalah <b>{ROLE_LABELS[role]}</b>, yang tidak memiliki
        akses ke {scope} ini. Hubungi administrator bila akses dibutuhkan.
      </div>
      <Link className="btn btn-p mt-5" href="/">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
