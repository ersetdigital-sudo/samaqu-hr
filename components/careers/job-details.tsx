import Link from "next/link";
import type { JobInput } from "@/lib/recruitment/live/types";
import { effectiveStatus } from "@/lib/recruitment/live/validation";
import { CareerHeader, CareerIcon, JobInfo } from "./primitives";
import styles from "./careers.module.css";

const selectionSteps = [
  ["Isi form dan upload CV", "Sekitar 5 menit"],
  ["Seleksi berkas", "Kalau lolos, kami hubungi via WhatsApp"],
  ["Interview", "Ngobrol langsung dengan tim SAMAQU"],
  ["Keputusan", "Diterima atau tidak, kamu tetap dikabari"],
];

/** Also renders unsaved dashboard previews; deliberately has no server dependencies. */
export function JobDetails({
  job,
  preview = false,
}: {
  job: JobInput;
  preview?: boolean;
}) {
  const closed = effectiveStatus(job.status, job.closes_at) === "Ditutup";
  return (
    <div className={`${styles.shell} ${preview ? styles.preview : ""}`}>
      <CareerHeader otherJobs />
      <main className={styles.details}>
        <div className={styles.hero}>
          <span className={`${styles.badge} ${closed ? styles.closed : ""}`}>
            {closed ? "Lowongan ditutup" : "Lowongan dibuka"}
          </span>
          <h1>{job.title}</h1>
          <p>{job.summary}</p>
          <JobInfo {...job} />
        </div>
        {closed && (
          <section className={styles.card}>
            <h2>Lowongan ini sudah ditutup</h2>
            <p className={styles.helper}>
              Kamu masih bisa melihat lowongan lain yang tersedia.
            </p>
          </section>
        )}
        <section className={styles.card}>
          <h2>Yang kamu kerjakan</h2>
          <ul className={styles.bullets}>
            {job.duties.map((duty, i) => (
              <li key={i}>{duty}</li>
            ))}
          </ul>
        </section>
        <section className={styles.card}>
          <h2>Kualifikasi</h2>
          <ul className={styles.bullets}>
            {job.qualifications.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
        <section className={`${styles.card} ${styles.process}`}>
          <h2>Proses seleksi</h2>
          <ol className={styles.timeline}>
            {selectionSteps.map(([title, text], i) => (
              <li key={title}>
                <span
                  className={`${styles.number} ${i === 0 ? styles.numberActive : ""}`}
                >
                  {i + 1}
                </span>
                <div className={styles.timelineText}>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className={styles.prepare}>
          <h2>Siapkan dulu sebelum melamar</h2>
          <div>
            <CareerIcon name="file" />
            CV dalam format PDF, maksimal 2 MB
          </div>
          <div>
            <CareerIcon name="phone" />
            Nomor WhatsApp yang aktif
          </div>
        </section>
      </main>
      <div className={styles.actionBar}>
        {closed ? (
          <Link href="/karir" className={styles.primary}>
            Lihat lowongan lain
          </Link>
        ) : preview ? (
          <button type="button" className={styles.primary} disabled>
            Lamar Sekarang
          </button>
        ) : (
          <Link
            href={`/karir/${encodeURIComponent(job.slug)}/lamar`}
            className={styles.primary}
          >
            Lamar Sekarang
          </Link>
        )}
        {!closed && <span>Gratis, tanpa biaya apa pun</span>}
      </div>
    </div>
  );
}
