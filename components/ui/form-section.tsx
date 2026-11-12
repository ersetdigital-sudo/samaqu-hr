"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import type { IconName } from "@/lib/data";
import styles from "./form-section.module.css";

/** Kartu seksi form reusable: ikon, judul, deskripsi, dan pembatas. */
export function FormSection({
  icon,
  title,
  description,
  children,
}: {
  icon: IconName;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.iconWrap} aria-hidden="true">
          <Icon name={icon} style={{ width: 17, height: 17 }} />
        </span>
        <div className="min-w-0">
          <div className={styles.sectionTitle}>{title}</div>
          {description && (
            <div className={styles.sectionDescription}>{description}</div>
          )}
        </div>
      </div>
      <div className={styles.divider} />
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

export function FormField({
  label,
  required = false,
  error,
  hint,
  span = "full",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  span?: "full" | "half";
  children: ReactNode;
}) {
  return (
    <div
      className={`${styles.field} ${
        span === "half" ? styles.half : styles.full
      }`}
    >
      <label className={styles.label}>
        {label}
        {required && (
          <>
            <span className={styles.required} aria-hidden="true" />
            <span className="sr-only">wajib diisi</span>
          </>
        )}
      </label>
      {children}
      {error && <div className={styles.error}>{error}</div>}
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}

export function FormInfoStrip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={styles.infoStrip}>
      <div className="min-w-0">
        <div className={styles.infoLabel}>{label}</div>
        {hint && <div className={styles.infoHint}>{hint}</div>}
      </div>
      <span className={styles.infoBadge}>{value}</span>
    </div>
  );
}

export function FormUnsavedIndicator({
  label = "Belum disimpan",
}: {
  label?: string;
}) {
  return (
    <span className={styles.unsaved}>
      <span className={styles.unsavedDot} aria-hidden="true" />
      {label}
    </span>
  );
}
