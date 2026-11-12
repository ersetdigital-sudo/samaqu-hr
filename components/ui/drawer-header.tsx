"use client";

import styles from "./drawer-header.module.css";

export function DrawerHeader({
  title,
  onClose,
  closeLabel = "Tutup",
}: {
  title: string;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <div className={styles.header}>
      <span className={styles.title}>{title}</span>
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label={closeLabel}
      >
        ✕
      </button>
    </div>
  );
}
