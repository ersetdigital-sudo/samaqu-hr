export const SIDEBAR_COOKIE = "samaqu-sidebar-collapsed";

export function sidebarCollapsedFromCookie(value: string | undefined): boolean {
  return value === "1";
}
