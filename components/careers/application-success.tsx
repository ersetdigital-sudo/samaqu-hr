"use client";

import Link from "next/link";
import { useState } from "react";
import { careersJobsHref } from "@/lib/careers/urls";
import { CareerHeader, CareerIcon } from "./primitives";
import styles from "./careers.module.css";

export function ApplicationSuccess({
  applicationNumber,
  jobTitle,
}: {
  applicationNumber: string;
  jobTitle: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(applicationNumber);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }
  return (
    <div className={styles.shell}>
      <CareerHeader />
      <main className={styles.success}>
        <div className={styles.successIcon}>
          <CareerIcon name="check" size={36} strokeWidth={2.5} />
        </div>
        <div className={styles.successIntro}>
          <h1 tabIndex={-1} id="application-success">
            Lamaran terkirim
          </h1>
          <p>
            Terima kasih, lamaran kamu untuk posisi <strong>{jobTitle}</strong>{" "}
            sudah kami terima.
          </p>
        </div>
        <div className={`${styles.card} ${styles.applicationNumber}`}>
          <div>
            <span>Nomor lamaran</span>
            <strong>{applicationNumber}</strong>
          </div>
          <button
            type="button"
            className={styles.smallButton}
            onClick={copyNumber}
          >
            <CareerIcon
              name={copyState === "copied" ? "check" : "copy"}
              size={15}
            />
            {copyState === "copied" ? "Tersalin" : "Salin"}
          </button>
        </div>
        {copyState !== "idle" && (
          <p
            role="status"
            className={copyState === "error" ? styles.error : styles.helper}
          >
            {copyState === "error"
              ? "Nomor belum berhasil disalin. Coba lagi atau salin nomor lamaran secara manual."
              : "Nomor lamaran berhasil disalin."}
          </p>
        )}
        <section className={`${styles.card} ${styles.process}`}>
          <h2>Apa selanjutnya?</h2>
          <ol className={styles.timeline}>
            <li>
              <span className={`${styles.number} ${styles.numberActive}`}>
                <CareerIcon name="check" size={13} strokeWidth={3} />
              </span>
              <div className={styles.timelineText}>
                <strong>Lamaran diterima</strong>
                <span>Baru saja</span>
              </div>
            </li>
            <li>
              <span className={styles.number}>2</span>
              <div className={styles.timelineText}>
                <strong>Seleksi berkas</strong>
                <span>Tim SAMAQU cek CV dan data kamu</span>
              </div>
            </li>
            <li>
              <span className={styles.number}>3</span>
              <div className={styles.timelineText}>
                <strong>Undangan interview</strong>
                <span>Dikirim lewat WhatsApp kalau kamu lolos</span>
              </div>
            </li>
          </ol>
        </section>
        <p className={styles.successNote}>
          Simpan nomor lamaran ini. Sebutkan nomornya kalau mau tanya status
          lamaran.
        </p>
        <Link
          prefetch={false}
          href={careersJobsHref()}
          className={styles.secondary}
        >
          Lihat lowongan lain
        </Link>
      </main>
    </div>
  );
}
