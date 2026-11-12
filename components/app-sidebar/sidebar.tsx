"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import {
  NAV_GROUPS,
  findModuleByPath,
  isModuleLive,
  isSubItemLive,
  moduleVisibleFor,
  visibleSubItems,
  type NavModule,
  type NavSubItem,
} from "@/lib/navigation";
import { ROLE_LABELS, type SessionUser } from "@/lib/session";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { SidebarFlyout } from "./sidebar-flyout";
import { SidebarToggle } from "./sidebar-toggle";
import { SidebarTooltip } from "./sidebar-tooltip";
import { useSidebarState } from "./use-sidebar-state";
import styles from "./sidebar.module.css";

type FlyoutState = {
  module: NavModule;
  items: NavSubItem[];
  anchor: HTMLElement;
};

function ItemContent({
  module,
  subItems,
  open,
}: {
  module: NavModule;
  subItems: NavSubItem[];
  open: boolean;
}) {
  const showSoon = !isModuleLive(module);

  return (
    <>
      <span className={styles.itemIcon}>
        <Icon name={module.icon} />
      </span>
      <span className={styles.itemLabel}>
        <span className={styles.labelText}>{module.label}</span>
        {showSoon && <span className={styles.soonBadge}>Segera</span>}
      </span>
      {module.external && (
        <Icon name="external" className={styles.externalIcon} />
      )}
      {subItems.length > 0 && (
        <Icon
          name="chevron"
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
      )}
    </>
  );
}

export function Sidebar({
  user,
  initialCollapsed,
}: {
  user: SessionUser;
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle } = useSidebarState(initialCollapsed);
  const activeModule = findModuleByPath(pathname);
  const [openModules, setOpenModules] = useState<Set<string>>(
    () => new Set(activeModule ? [activeModule.id] : []),
  );
  const [flyout, setFlyout] = useState<FlyoutState | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  useEffect(() => {
    if (!activeModule) return;
    setOpenModules((current) => {
      if (current.has(activeModule.id)) return current;
      const next = new Set(current);
      next.add(activeModule.id);
      return next;
    });
  }, [activeModule?.id]);

  useEffect(() => {
    setFlyout(null);
  }, [pathname]);

  useEffect(() => {
    if (!collapsed) setFlyout(null);
  }, [collapsed]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    await createBrowserSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const toggleModule = (id: string) => {
    setOpenModules((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openFlyout = (next: FlyoutState) => {
    clearTimers();
    setFlyout(next);
  };

  const scheduleFlyout = (
    module: NavModule,
    items: NavSubItem[],
    anchor: HTMLElement,
  ) => {
    if (!collapsed || !items.length) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    openTimer.current = setTimeout(() => {
      setFlyout({ module, items, anchor });
    }, 320);
  };

  const scheduleFlyoutClose = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (!flyout) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFlyout(null), 140);
  };

  const closeFlyout = (restoreFocus?: boolean) => {
    const anchor = flyout?.anchor;
    clearTimers();
    setFlyout(null);
    if (restoreFocus) requestAnimationFrame(() => anchor?.focus());
  };

  return (
    <aside
      id="side"
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""} hidden lg:flex flex-col shrink-0 bg-white border-r sticky top-0 h-screen self-start`}
      style={{ borderColor: "var(--line)" }}
    >
      <div className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo}>S</div>
          <div className={styles.brandText}>
            <strong>SAMAQU</strong>
            <span>HRIS</span>
          </div>
        </div>
        <SidebarToggle collapsed={collapsed} onToggle={toggle} />
      </div>

      <div className={`${styles.navScroll} no-scrollbar`}>
        {NAV_GROUPS.map((group) => {
          const modules = group.modules.filter((module) =>
            moduleVisibleFor(user.role, module, user.employeeId),
          );
          if (modules.length === 0) return null;

          return (
            <div key={group.id} className={styles.group}>
              <div className={`nav-label ${styles.groupLabel}`}>
                {group.label}
              </div>
              <nav className="nav" aria-label={group.label}>
                {modules.map((module) => {
                  const subItems = visibleSubItems(user.role, module);
                  const active = activeModule?.id === module.id;
                  const open = openModules.has(module.id);
                  const flyoutOpen = flyout?.module.id === module.id;
                  const flyoutId = `sidebar-flyout-${module.id}`;
                  const submenuId = `sidebar-submenu-${module.id}`;

                  if (subItems.length === 0) {
                    const itemContent = (
                      <ItemContent
                        module={module}
                        subItems={subItems}
                        open={false}
                      />
                    );
                    const external = Boolean(module.external);
                    const tooltipLabel = external
                      ? `${module.label} (buka tab baru)`
                      : module.label;
                    return (
                      <div key={module.id} className={styles.module}>
                        <SidebarTooltip
                          label={tooltipLabel}
                          enabled={collapsed}
                        >
                          {external ? (
                            <a
                              href={module.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${styles.itemRow} ${active ? "on" : ""}`}
                              aria-label={tooltipLabel}
                            >
                              {itemContent}
                            </a>
                          ) : (
                            <Link
                              href={module.href}
                              prefetch={false}
                              className={`${styles.itemRow} ${active ? "on" : ""}`}
                              aria-current={active ? "page" : undefined}
                              aria-label={collapsed ? module.label : undefined}
                            >
                              {itemContent}
                            </Link>
                          )}
                        </SidebarTooltip>
                      </div>
                    );
                  }

                  return (
                    <div key={module.id} className={styles.module}>
                      <SidebarTooltip
                        label={module.label}
                        enabled={collapsed && !flyoutOpen}
                      >
                        <button
                          type="button"
                          className={`${styles.itemRow} nav-item ${active ? "on" : ""}`}
                          aria-label={collapsed ? module.label : undefined}
                          aria-expanded={collapsed ? flyoutOpen : open}
                          aria-controls={
                            collapsed
                              ? flyoutOpen
                                ? flyoutId
                                : undefined
                              : submenuId
                          }
                          onClick={(event) => {
                            if (!collapsed) {
                              toggleModule(module.id);
                              return;
                            }
                            if (flyoutOpen) {
                              closeFlyout(false);
                              return;
                            }
                            openFlyout({
                              module,
                              items: subItems,
                              anchor: event.currentTarget,
                            });
                          }}
                          onPointerEnter={(event) =>
                            scheduleFlyout(
                              module,
                              subItems,
                              event.currentTarget,
                            )
                          }
                          onPointerLeave={() => {
                            if (collapsed) scheduleFlyoutClose();
                          }}
                        >
                          <ItemContent
                            module={module}
                            subItems={subItems}
                            open={collapsed ? flyoutOpen : open}
                          />
                        </button>
                      </SidebarTooltip>

                      <div
                        id={submenuId}
                        className={styles.submenu}
                        data-open={open}
                        inert={collapsed || !open}
                        aria-hidden={collapsed || !open ? true : undefined}
                      >
                        <div className={styles.submenuClip}>
                          <div className="nav-sub">
                            {subItems.map((item) =>
                              isSubItemLive(module, item) ? (
                                <Link
                                  key={item.id}
                                  href={item.href}
                                  prefetch={false}
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
                              ),
                            )}
                          </div>
                        </div>
                      </div>

                      {collapsed && flyoutOpen && (
                        <SidebarFlyout
                          id={flyoutId}
                          module={module}
                          items={subItems}
                          anchor={flyout.anchor}
                          onClose={closeFlyout}
                          onPointerEnter={() => {
                            if (closeTimer.current) {
                              clearTimeout(closeTimer.current);
                              closeTimer.current = null;
                            }
                          }}
                          onPointerLeave={scheduleFlyoutClose}
                        />
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
        className={`${styles.footer} ${collapsed ? styles.footerCollapsed : ""}`}
        style={{ borderColor: "var(--line)" }}
      >
        <div className="av">{user.initials}</div>
        <div className={styles.userText}>
          <div className="font-semibold text-[13px] truncate">{user.name}</div>
          <div className="text-[11px] sub truncate">
            {ROLE_LABELS[user.role]}
          </div>
        </div>
        {collapsed ? (
          <SidebarTooltip
            label="Keluar"
            enabled
            className={styles.logoutTooltip}
          >
            <button
              className={`btn btn-g ${styles.logout}`}
              onClick={() => void signOut()}
              disabled={signingOut}
              aria-label="Keluar"
            >
              <Icon name="logout" />
            </button>
          </SidebarTooltip>
        ) : (
          <button
            className={`btn btn-g ${styles.logout}`}
            onClick={() => void signOut()}
            disabled={signingOut}
            aria-label="Keluar"
          >
            {signingOut ? "…" : "Keluar"}
          </button>
        )}
      </div>
    </aside>
  );
}
