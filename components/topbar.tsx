"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { useRecruitment } from "@/components/recruitment-provider";
import { findModuleByPath, findSubItem } from "@/lib/navigation";
import type { SessionUser } from "@/lib/session";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function Topbar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setCandQ } = useRecruitment();
  const [search, setSearch] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const activeModule = findModuleByPath(pathname);
  const activeSub = findSubItem(activeModule, pathname);
  const moduleLabel = activeModule?.label ?? "Dashboard";

  const handleSearch = (value: string) => {
    setSearch(value);
    setCandQ(value);
    router.push("/recruitment/kandidat");
  };

  const signOut = async () => {
    setSigningOut(true);
    await createBrowserSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <header
      className="h-16 bg-white border-b flex items-center gap-4 px-5 lg:px-8 sticky top-0 z-30"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="lg:hidden font-extrabold" style={{ color: "var(--pink)" }}>
        SAMAQU
      </div>
      <div className="text-[13px] sub hidden md:block">
        <span id="mod">{moduleLabel}</span>
        {activeSub && (
          <>
            <span className="mx-1">/</span>{" "}
            <b id="crumb" style={{ color: "var(--ink)" }}>
              {activeSub.label}
            </b>
          </>
        )}
      </div>
      <div className="flex-1"></div>

      {canAccessSearch(user) && (
        <div className="relative hidden md:block w-72">
          <input
            className="inp pl-9"
            placeholder="Cari kandidat, lowongan…"
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
          />
          <Icon
            name="search"
            className="absolute left-3 top-[11px]"
            style={{ color: "#A59B97", width: 16 }}
          />
        </div>
      )}

      <div className="hidden lg:flex items-center gap-2 text-[12px] sub">
        <span className="font-semibold" style={{ color: "var(--ink)" }}>
          {user.name}
        </span>
      </div>

      <button
        className="btn btn-g !px-2.5 !py-1 !text-[11px] lg:hidden"
        onClick={() => void signOut()}
        disabled={signingOut}
      >
        {signingOut ? "…" : "Keluar"}
      </button>
    </header>
  );
}

/** Pencarian global hanya untuk modul rekrutmen. */
function canAccessSearch(user: SessionUser): boolean {
  return user.role === "hr_manager" || user.role === "recruiter";
}
