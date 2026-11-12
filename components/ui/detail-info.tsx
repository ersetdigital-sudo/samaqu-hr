import type { ReactNode } from "react";
import styles from "./detail-info.module.css";

/** Pasangan label/nilai baca-saja untuk drawer detail. */
export function InfoGrid({
  children,
  single = false,
}: {
  children: ReactNode;
  single?: boolean;
}) {
  return (
    <dl className={`${styles.grid} ${single ? styles.single : ""}`}>
      {children}
    </dl>
  );
}

export function InfoItem({
  label,
  value,
  full = false,
}: {
  label: string;
  value: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`${styles.item} ${full ? styles.full : ""}`}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </div>
  );
}

/** Kartu perbandingan sebelum → sesudah untuk riwayat perubahan. */
export function CompareItem({
  label,
  before,
  after,
  changed,
}: {
  label: string;
  before: ReactNode;
  after: ReactNode;
  changed: boolean;
}) {
  return (
    <div className={styles.compare}>
      <div className={styles.compareHeader}>
        <span className={styles.compareLabel}>{label}</span>
        {!changed && <span className={styles.unchanged}>Tidak berubah</span>}
      </div>
      <div className={styles.compareValue}>
        {changed ? (
          <>
            <span className={styles.before}>{before}</span>{" "}
            <span aria-hidden="true">→</span> <b>{after}</b>
          </>
        ) : (
          before
        )}
      </div>
    </div>
  );
}
