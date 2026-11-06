import Link from "next/link";
import { getPublicJobs } from "@/lib/recruitment/live/public-repository";
import { CareerHeader, JobInfo } from "@/components/careers/primitives";
import styles from "@/components/careers/careers.module.css";

export const dynamic = "force-dynamic";

export default async function CareersPage() {
  const jobs = await getPublicJobs();
  return <div className={styles.shell}>
    <CareerHeader />
    <main className={`${styles.details} ${styles.list}`}>
      <div className={styles.hero}><h1>Karir di SAMAQU</h1><p>Temukan posisi yang cocok untuk kamu.</p></div>
      {jobs.length === 0 ? <section className={styles.card}><h2>Belum ada lowongan dibuka</h2><p className={styles.helper}>Cek lagi nanti untuk kesempatan bergabung bersama SAMAQU.</p></section> : jobs.map(job => <article key={job.id} className={`${styles.card} ${styles.listCard}`}>
        <span className={styles.badge}>Lowongan dibuka</span>
        <h2>{job.title}</h2><p>{job.department}</p><JobInfo {...job} />
        <Link className={styles.primary} href={`/karir/${encodeURIComponent(job.slug)}`} aria-label={`Lihat lowongan ${job.title}`}>Lihat</Link>
      </article>)}
    </main>
  </div>;
}
