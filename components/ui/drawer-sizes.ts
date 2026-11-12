export const DRAWER_SIZE_CLASS = {
  sm: "drawer-sm",
  md: "drawer-md",
  lg: "drawer-lg",
} as const;

export type DrawerSize = keyof typeof DRAWER_SIZE_CLASS;
