"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import {
  NAV_GROUPS,
  canAccess,
  findModuleByPath,
  isSubItemLive,
  visibleSubItems,
} from "@/lib/navigation";
import { ROLE_LABELS, type SessionUser } from "@/lib/session";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const activeModule = findModuleByPath(pathname);

  const signOut = async () => {
    setSigningOut(true);
    await createBrowserSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside
      id="side"
      className="hidden lg:flex flex-col w-[252px] shrink-0 bg-white border-r sticky top-0 h-screen self-start"
      style={{ borderColor: "var(--line)" }}
    >
      <div
        className="px-6 h-16 flex items-center gap-2 border-b"
        style={{ borderColor: "var(--line)" }}
      >
        <div
          className="w-8 h-8 rounded-lg grid place-items-center text-white font-extrabold"
          style={{ background: "var(--pink)" }}
        >
          S
        </div>
        <div>
          <div className="font-extrabold tracking-tight text-[17px] leading-none">
            SAMAQU
          </div>
          <div
            className="text-[10px] font-semibold tracking-wider mt-1"
            style={{ color: "#A59B97" }}
          >
            HRIS
          </div>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-auto">
        {NAV_GROUPS.map((group) => {
          const modules = group.modules.filter((module) =>
            canAccess(user.role, module)
          );
          if (modules.length === 0) return null;

          return (
            <div key={group.id} className="mb-5 last:mb-0">
              <div className="nav-label">{group.label}</div>
              <nav className="nav">
                {modules.map((module) => {
                  const active = activeModule?.id === module.id;
                  const subItems = active
                    ? visibleSubItems(user.role, module)
                    : [];

                  return (
                    <div key={module.id}>
                      <Link
                        href={module.href}
                        className={active ? "on" : ""}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon name={module.icon} />
                        <span className="flex-1 truncate text-[13px]">
                          {module.label}
                        </span>
                        {module.status === "planned" && (
                          <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded bg-[#F2EEEC] text-[#8A8380]">
                            Baru
                          </span>
                        )}
                      </Link>

                      {subItems.length > 0 && (
                        <div className="nav-sub">
                          {subItems.map((item) =>
                            isSubItemLive(module, item) ? (
                              <Link
                                key={item.id}
                                href={item.href}
                                className={pathname === item.href ? "on" : ""}
                                aria-current={
                                  pathname === item.href ? "page" : undefined
                                }
                              >
                                {item.label}
                              </Link>
                            ) : (
                              <span key={item.id} className="nav-soon">
                                {item.label}
                                <em>Segera</em>
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      <div
        className="p-4 border-t flex items-center gap-3"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="av">{user.initials}</div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[13px] truncate">{user.name}</div>
          <div className="text-[11px] sub truncate">{ROLE_LABELS[user.role]}</div>
        </div>
        <button
          className="btn btn-g !px-2.5 !py-1 !text-[11px]"
          onClick={() => void signOut()}
          disabled={signingOut}
        >
          {signingOut ? "…" : "Keluar"}
        </button>
      </div>
    </aside>
  );
}
