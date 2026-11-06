"use client";

import { CareerHeader } from "@/components/careers/primitives";
import styles from "@/components/careers/careers.module.css";

export default function CareerError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.shell}>
      <CareerHeader />
      <main className={`${styles.details} ${styles.list}`}>
        <div className={styles.hero}>
          <h1>Halaman belum bisa dimuat</h1>
          <p>
            Terjadi kendala saat mengambil lowongan. Coba lagi sebentar, ya.
          </p>
        </div>
        <button type="button" className={styles.primary} onClick={reset}>
          Coba lagi
        </button>
      </main>
    </div>
  );
}
