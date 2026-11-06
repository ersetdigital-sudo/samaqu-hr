"use client";

import { useCallback, useEffect, useState } from "react";
import { SIDEBAR_COOKIE } from "@/lib/sidebar-cookie";

function writeCollapsedCookie(collapsed: boolean) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  try {
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  } catch {
    // Cookie can be unavailable in hardened browser contexts.
  }
}

export function useSidebarState(initialCollapsed: boolean) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      writeCollapsedCookie(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
        return;
      }
      if (
        event.key.toLowerCase() !== "b" ||
        !window.matchMedia("(min-width: 1024px)").matches
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }
      event.preventDefault();
      toggle();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return { collapsed, toggle };
}
