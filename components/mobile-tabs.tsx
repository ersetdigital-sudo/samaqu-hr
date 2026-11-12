"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ALL_MODULES,
  findModuleByPath,
  isSubItemLive,
  moduleVisibleFor,
  visibleSubItems,
} from "@/lib/navigation";
import type { SessionUser } from "@/lib/session";

/** Navigasi mobile: baris modul, lalu submenu modul yang sedang dibuka. */
export function MobileTabs({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const activeModule = findModuleByPath(pathname);
  const subItems = activeModule
    ? visibleSubItems(user.role, activeModule).filter((item) =>
        isSubItemLive(activeModule, item),
      )
    : [];

  return (
    <div
      className="lg:hidden bg-white border-b"
      style={{ borderColor: "var(--line)" }}
    >
      <div
        className="flex gap-1 overflow-auto no-scrollbar px-3 py-2"
        id="mnav"
      >
        {ALL_MODULES.filter((module) =>
          moduleVisibleFor(user.role, module, user.employeeId),
        ).map(
          (module) =>
            module.external ? (
              <a
                key={module.id}
                href={module.href}
                target="_blank"
                rel="noopener noreferrer"
                className="tab whitespace-nowrap"
                aria-label={`${module.label} (buka tab baru)`}
              >
                {module.label}
              </a>
            ) : (
              <Link
                key={module.id}
                href={module.href}
                prefetch={false}
                className={`tab ${
                  activeModule?.id === module.id ? "on" : ""
                } whitespace-nowrap`}
              >
                {module.label}
              </Link>
            ),
        )}
      </div>

      {subItems.length > 0 && (
        <div
          className="flex gap-1 overflow-auto no-scrollbar px-3 pb-2"
          id="msubnav"
        >
          {subItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              prefetch={false}
              className={`tab ${
                pathname === item.href ? "on" : ""
              } whitespace-nowrap`}
              style={{ fontSize: 12, padding: "6px 11px" }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
