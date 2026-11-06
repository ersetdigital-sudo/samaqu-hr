"use client";

import { Icon } from "@/components/icons";
import styles from "./sidebar.module.css";

export function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={onToggle}
      aria-label={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
      aria-expanded={!collapsed}
      aria-controls="side"
      aria-keyshortcuts="Control+B Meta+B"
      title={
        collapsed ? "Lebarkan sidebar (Ctrl+B)" : "Ciutkan sidebar (Ctrl+B)"
      }
    >
      <Icon name="panel" className={styles.toggleIcon} />
    </button>
  );
}
