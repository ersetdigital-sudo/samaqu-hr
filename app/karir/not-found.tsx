import Link from "next/link";
import { CareerHeader } from "@/components/careers/primitives";
import styles from "@/components/careers/careers.module.css";

export default function CareerNotFound() {
  return (
    <div className={styles.shell}>
      <CareerHeader />
      <main className={`${styles.details} ${styles.list}`}>
        <div className={styles.hero}>
          <h1>Lowongan tidak ditemukan</h1>
          <p>
            Link lowongan ini tidak tersedia. Kamu bisa melihat lowongan lain
            yang sedang dibuka.
          </p>
        </div>
        <Link href="/karir" className={styles.primary}>
          Lihat lowongan lain
        </Link>
      </main>
    </div>
  );
}
