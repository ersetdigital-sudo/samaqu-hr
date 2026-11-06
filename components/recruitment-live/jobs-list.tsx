"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobPosting, JobSummary } from "@/lib/recruitment/live/types";
import { api, Badge, ConfirmDialog, CopyButton, dateLabel, ErrorBox, Icon, useOrigin } from "./ui";

export function JobsList({ jobs: initialJobs, error: initialError }: { jobs: JobSummary[]; error?: string }) {
  const router = useRouter();
  const origin = useOrigin();
  const [jobs, setJobs] = useState(initialJobs);
  const [filter, setFilter] = useState("Semua");
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ job: JobSummary; action: "publish" | "close" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => setJobs(initialJobs), [initialJobs]);
  useEffect(() => {
    const dismiss = (event: MouseEvent) => { root.current?.querySelectorAll("details[open]").forEach(detail => { if (!detail.contains(event.target as Node)) detail.removeAttribute("open"); }); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") root.current?.querySelectorAll("details[open]").forEach(detail => detail.removeAttribute("open")); };
    document.addEventListener("click", dismiss); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("click", dismiss); document.removeEventListener("keydown", escape); };
  }, []);
  const message = (text: string, error?: boolean) => setNotice({ text, error });
  const ask = (job: JobSummary, action: "publish" | "close") => { setActionError(""); setConfirm({ job, action }); root.current?.querySelectorAll("details[open]").forEach(detail => detail.removeAttribute("open")); };
  async function mutate() {
    if (!confirm || busy) return;
    setBusy(true); setActionError("");
    try {
      const { job } = await api<{ job: JobPosting }>(`/api/recruitment/jobs/${confirm.job.id}`, { method: "PATCH", body: JSON.stringify({ action: confirm.action }) });
      setJobs(current => current.map(item => item.id === job.id ? { ...item, ...job } : item));
      message(confirm.action === "publish" ? "Lowongan berhasil dipublikasikan." : "Lowongan berhasil ditutup.");
      setConfirm(null); router.refresh();
    } catch (error) { setActionError(error instanceof Error ? error.message : "Tidak dapat memperbarui lowongan."); }
    finally { setBusy(false); }
  }
  const shown = jobs.filter(job => filter === "Semua" || job.status === filter);
  return <div ref={root} className="rl">
    <div className="rl-header"><div className="rl-heading"><h1>Lowongan</h1><p className="rl-subtitle">Buat lowongan, bagikan link-nya, dan pantau pelamar yang masuk.</p></div><div className="rl-row"><a href="/karir" target="_blank" rel="noopener noreferrer" className="rl-btn" style={{ fontWeight: 600 }}><Icon name="external" />Halaman Karir</a><Link href="/recruitment/lowongan/baru" className="rl-btn rl-primary" style={{ padding: "0 18px" }}><Icon name="plus" />Buat Lowongan</Link></div></div>
    {initialError && <ErrorBox message={initialError} retry={() => router.refresh()} />}
    {notice && <div role={notice.error ? "alert" : "status"} className={notice.error ? "rl-error-box" : "rl-notice"}>{notice.text}</div>}
    <div className="rl-tabs" role="group" aria-label="Filter status">{["Semua", "Aktif", "Draf", "Ditutup"].map(status => <button key={status} type="button" aria-pressed={filter === status} className={`rl-btn rl-tab${filter === status ? " rl-primary" : ""}`} onClick={() => setFilter(status)}>{status} · {status === "Semua" ? jobs.length : jobs.filter(job => job.status === status).length}</button>)}</div>
    {!initialError && !shown.length && <div className="rl-card rl-empty"><h2>{jobs.length ? "Tidak ada lowongan pada status ini" : "Belum ada lowongan"}</h2><p>{jobs.length ? "Pilih status lain untuk melihat lowongan." : "Buat lowongan pertama untuk mulai menerima pelamar."}</p>{!jobs.length && <Link href="/recruitment/lowongan/baru" className="rl-btn rl-primary"><Icon name="plus" />Buat Lowongan</Link>}</div>}
    <div className="rl-card-grid">{shown.map(job => {
      const link = origin ? `${origin}/karir/${job.slug}` : "";
      const duplicate = `/recruitment/lowongan/baru?duplicate=${encodeURIComponent(job.id)}`;
      return <article key={job.id} className="rl-card">
        <div className="rl-job-top"><div className="rl-stack" style={{ gap: 6 }}><Badge value={job.status} /><h2 className="rl-job-title">{job.title}</h2><span className="rl-muted">{job.department} · {job.employment_type} · {job.status === "Ditutup" ? (job.closed_at || job.closes_at ? `Ditutup ${dateLabel(job.closed_at || job.closes_at)}` : "Ditutup manual") : job.closes_at ? `Tutup ${dateLabel(job.closes_at)}` : "Belum ada tanggal tutup"}</span></div>
        <details className="rl-menu"><summary className="rl-btn rl-icon-btn" aria-label={`Menu lowongan ${job.title}`}><Icon name="more" /></summary><div className="rl-menu-pop"><Link href={`/recruitment/lowongan/${job.id}/edit`}>Edit</Link><Link href={duplicate}>Duplikat</Link>{job.status === "Aktif" && <button type="button" onClick={() => ask(job, "close")}>Tutup Lowongan</button>}{job.status === "Draf" && <button type="button" onClick={() => ask(job, "publish")}>Publikasikan</button>}</div></details></div>
        {job.status === "Draf" ? <><div className="rl-draft"><strong>Belum dipublikasikan</strong><span className="rl-muted">Pelamar belum bisa melihat lowongan ini. Link aktif setelah dipublikasikan.</span></div><div style={{ flex: 1 }} /><div className="rl-two"><Link href={`/recruitment/lowongan/${job.id}/edit`} className="rl-btn">Edit</Link><button type="button" className="rl-btn rl-primary" onClick={() => ask(job, "publish")}>Publikasikan</button></div></> : <>
          <div className="rl-stats"><div className="rl-stat"><strong>{job.applicant_count}</strong><span>Pelamar</span></div><div className={`rl-stat ${job.status === "Aktif" ? "rl-stat-warning" : "rl-stat-success"}`}><strong>{job.status === "Aktif" ? job.unreviewed_count : job.accepted_count}</strong><span>{job.status === "Aktif" ? "Belum dicek" : "Diterima"}</span></div><div className="rl-stat"><strong>{job.headcount}</strong><span>Dibutuhkan</span></div></div>
          {job.status === "Aktif" ? <><div className="rl-stack" style={{ gap: 8 }}><span className="rl-muted" style={{ fontSize: 12.5, fontWeight: 600 }}>Link lowongan</span><div className="rl-linkbox"><span title={link}>{link || `/karir/${job.slug}`}</span><CopyButton value={link} onMessage={message} /><a href={`https://wa.me/?text=${encodeURIComponent(`${job.title} — ${job.summary}\n${link}`)}`} target="_blank" rel="noopener noreferrer" className="rl-btn rl-small rl-green">WhatsApp</a></div></div><Link href={`/recruitment/lowongan/${job.id}/pelamar`} className="rl-btn rl-primary">Lihat Pelamar</Link></> : <><span className="rl-muted">Link menampilkan &quot;Lowongan sudah ditutup&quot; ke pelamar.</span><div className="rl-two"><Link href={`/recruitment/lowongan/${job.id}/pelamar`} className="rl-btn">Lihat Pelamar</Link><Link href={duplicate} className="rl-btn"><Icon name="copy" size={15} />Duplikat</Link></div></>}
        </>}
      </article>;
    })}</div>
    <div className="rl-career-strip"><Icon name="link" size={20} /><div className="rl-stack" style={{ flex: 1, minWidth: 220, gap: 2 }}><strong style={{ fontSize: 14 }}>Link halaman karir</strong><span className="rl-muted">Pasang di bio Instagram. Isinya otomatis semua lowongan yang sedang dibuka.</span></div><span className="rl-career-url">{origin}/karir</span><CopyButton value={origin ? `${origin}/karir` : ""} onMessage={message} /></div>
    {confirm && <ConfirmDialog title={confirm.action === "publish" ? "Publikasikan lowongan?" : "Tutup lowongan?"} description={confirm.action === "publish" ? `“${confirm.job.title}” akan tampil di halaman karir. Link lowongan tidak dapat diubah setelah dipublikasikan.` : `“${confirm.job.title}” tidak lagi menerima lamaran baru. Data pelamar yang sudah masuk tetap tersimpan.`} confirmLabel={confirm.action === "publish" ? "Publikasikan" : "Tutup Lowongan"} danger={confirm.action === "close"} busy={busy} error={actionError} onClose={() => setConfirm(null)} onConfirm={mutate} />}
  </div>;
}
