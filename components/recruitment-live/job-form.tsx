"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { JobDetails } from "@/components/careers/job-details";
import { EMPLOYMENT_TYPES, type FieldErrors, type JobInput, type JobPosting } from "@/lib/recruitment/live/types";
import { slugify, validateJob } from "@/lib/recruitment/live/validation";
import { api, ApiError, BackLink, ConfirmDialog, ErrorBox, Icon, Modal, useOrigin } from "./ui";

const emptyJob: JobInput = { title: "", slug: "", department: "", location: "", employment_type: "Full-time", headcount: 1, summary: "", duties: ["", ""], qualifications: [""], closes_at: null, status: "Draf" };

function Field({ name, label, required, error, children }: { name: string; label: string; required?: boolean; error?: string; children: ReactNode }) {
  return <div className="rl-field"><label htmlFor={name}>{label}{required && <span className="rl-required"> *</span>}</label>{children}{error && <span id={`${name}-error`} className="rl-error">{error}</span>}</div>;
}

export function JobForm({ initial, departments, duplicate = false }: { initial?: JobPosting | JobInput; departments: string[]; duplicate?: boolean }) {
  const router = useRouter();
  const origin = useOrigin();
  const [job, setJob] = useState<JobInput>(() => initial ? { ...initial, duties: initial.duties.length ? [...initial.duties] : [""], qualifications: initial.qualifications.length ? [...initial.qualifications] : [""] } : { ...emptyJob });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [customSlug, setCustomSlug] = useState(!!initial);
  const form = useRef<HTMLFormElement>(null);
  const existing = initial && "id" in initial && !duplicate ? initial : null;
  const published = !!existing?.published_at;
  const savedStatus = existing?.status ?? "Draf";
  const immutableStatus = published || savedStatus !== "Draf";
  const divs = Array.from(new Set([...departments, ...(job.department ? [job.department] : [])]));
  function update<K extends keyof JobInput>(key: K, value: JobInput[K]) {
    setJob(current => ({ ...current, [key]: value, ...(key === "title" && !customSlug && !published ? { slug: slugify(String(value)) } : {}) }));
    setErrors(current => { const next = { ...current }; delete next[key]; return next; });
  }
  const attrs = (key: keyof JobInput) => ({ id: key, name: key, "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `${key}-error` : undefined });
  function payload(status: JobInput["status"]): JobInput {
    return { title: job.title.trim(), slug: job.slug.trim(), department: job.department, location: job.location.trim(), employment_type: job.employment_type, headcount: job.headcount, summary: job.summary.trim(), duties: job.duties.map(item => item.trim()).filter(Boolean), qualifications: job.qualifications.map(item => item.trim()).filter(Boolean), closes_at: job.closes_at || null, status };
  }
  function validate(input: JobInput) {
    const next = validateJob(input); setErrors(next);
    if (Object.keys(next).length) { setError("Periksa isian yang ditandai sebelum menyimpan."); requestAnimationFrame(() => form.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus()); return false; }
    setError(""); return true;
  }
  async function save(status: JobInput["status"]) {
    if (busy) return;
    const input = payload(immutableStatus ? savedStatus : status);
    if (!validate(input)) { setConfirm(false); return; }
    setBusy(true);
    try {
      await api<{ job: JobPosting }>(existing ? `/api/recruitment/jobs/${existing.id}` : "/api/recruitment/jobs", { method: existing ? "PATCH" : "POST", body: JSON.stringify(input) });
      router.push("/recruitment/lowongan"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Lowongan gagal disimpan."); if (cause instanceof ApiError) setErrors(cause.fields); setBusy(false); }
  }
  const points = (key: "duties" | "qualifications", title: string, singular: string, example: string) => <section className="rl-card rl-points"><div className="rl-stack" style={{ gap: 3 }}><h2>{title}</h2><span className="rl-muted">Satu {key === "duties" ? "tugas" : "syarat"} per baris, maksimal 8 poin</span></div>{job[key].map((point, index) => <div key={index} className="rl-point"><input className="rl-input" value={point} aria-label={`${singular} ${index + 1}`} aria-invalid={!!errors[key] || !!errors[`${key}.${index}`]} aria-describedby={errors[key] ? `${key}-error` : undefined} placeholder={index === 0 ? example : `${singular} berikutnya`} onChange={event => update(key, job[key].map((value, i) => i === index ? event.target.value : value))} /><button type="button" className="rl-btn" aria-label={`Hapus ${singular.toLowerCase()} ${index + 1}`} onClick={() => update(key, job[key].filter((_, i) => i !== index))}><Icon name="close" /></button></div>)}<button type="button" className="rl-btn rl-add" disabled={job[key].length >= 8} onClick={() => update(key, [...job[key], ""])}><Icon name="plus" size={14} />Tambah poin</button>{errors[key] && <span id={`${key}-error`} className="rl-error">{errors[key]}</span>}{Object.entries(errors).filter(([name]) => name.startsWith(`${key}.`)).map(([name, text]) => <span key={name} className="rl-error">{text}</span>)}</section>;
  return <div className="rl"><div className="rl-form-header"><BackLink /><div className="rl-heading" style={{ gap: 4 }}><h1>{existing ? "Edit Lowongan" : duplicate ? "Duplikat Lowongan" : "Buat Lowongan"}</h1><p className="rl-subtitle" style={{ fontSize: 14 }}>{immutableStatus ? "Perbarui detail posisi tanpa mengubah link dan status lowongan." : "Isi detail posisi. Simpan sebagai draf dulu kalau belum siap dibagikan."}</p></div></div>
    <div className="rl-columns"><form ref={form} className="rl-form" noValidate onSubmit={event => { event.preventDefault(); void save(immutableStatus ? savedStatus : "Draf"); }} aria-busy={busy}>
      {error && <ErrorBox message={error} />}
      <fieldset disabled={busy} style={{ display: "contents" }}>
      <section className="rl-card" style={{ padding: 22, gap: 18 }}><h2>Info dasar</h2><Field name="title" label="Nama posisi" required error={errors.title}><input {...attrs("title")} className="rl-input" required value={job.title} placeholder="Contoh: Staf Admin" onChange={event => update("title", event.target.value)} /></Field>
        <div className="rl-fields-grid"><Field name="department" label="Divisi" required error={errors.department}><select {...attrs("department")} className="rl-input" required value={job.department} onChange={event => update("department", event.target.value)}><option value="">Pilih divisi</option>{divs.map(div => <option key={div} value={div}>{div}</option>)}</select>{!divs.length && <span className="rl-muted">Belum ada divisi di database. Tambahkan divisi di pengaturan organisasi.</span>}</Field><Field name="location" label="Lokasi kerja" required error={errors.location}><input {...attrs("location")} className="rl-input" required value={job.location} placeholder="Kota atau alamat kantor" onChange={event => update("location", event.target.value)} /></Field></div>
        <fieldset><legend>Tipe kerja <span className="rl-required">*</span></legend><div className="rl-row" style={{ gap: 8 }}>{EMPLOYMENT_TYPES.map(type => <button type="button" key={type} aria-pressed={job.employment_type === type} className={`rl-btn rl-type-chip${job.employment_type === type ? " rl-primary" : ""}`} onClick={() => update("employment_type", type)}>{type}</button>)}</div>{errors.employment_type && <span className="rl-error">{errors.employment_type}</span>}</fieldset>
        <div className="rl-fields-grid"><Field name="headcount" label="Jumlah dibutuhkan" required error={errors.headcount}><input {...attrs("headcount")} className="rl-input" type="number" min={1} step={1} required value={Number.isNaN(job.headcount) ? "" : job.headcount} onChange={event => update("headcount", event.target.value === "" ? NaN : Number(event.target.value))} /></Field><Field name="closes_at" label="Tanggal tutup" error={errors.closes_at}><input {...attrs("closes_at")} className="rl-input" type="date" value={job.closes_at || ""} onChange={event => update("closes_at", event.target.value || null)} /><span className="rl-muted" style={{ fontSize: 12.5 }}>Kosongkan kalau mau ditutup manual</span></Field></div>
      </section>
      <section className="rl-card rl-compact" style={{ padding: 22, gap: 10 }}><label htmlFor="summary" style={{ fontSize: 16, fontWeight: 700 }}>Deskripsi singkat <span className="rl-required">*</span></label><textarea {...attrs("summary")} className="rl-input" rows={3} maxLength={200} required value={job.summary} placeholder="1–2 kalimat tentang peran ini" onChange={event => update("summary", event.target.value)} /><span className="rl-counter">{job.summary.length} / 200</span>{errors.summary && <span id="summary-error" className="rl-error">{errors.summary}</span>}</section>
      {points("duties", "Yang dikerjakan", "Tugas", "Contoh: Input dan cek pesanan masuk setiap hari")}
      {points("qualifications", "Kualifikasi", "Kualifikasi", "Contoh: Minimal lulusan SMA/SMK sederajat")}
      <section className="rl-card rl-compact" style={{ padding: 22, gap: 10 }}><label htmlFor="slug" style={{ fontSize: 16, fontWeight: 700 }}>Link lowongan</label><div className="rl-slug"><span>{origin}/karir/</span><input {...attrs("slug")} className="rl-input" readOnly={published} value={job.slug} placeholder="staf-admin" onChange={event => { setCustomSlug(true); update("slug", event.target.value); }} /></div><span className="rl-muted" style={{ fontSize: 12.5 }}>{published ? "Link terkunci karena lowongan sudah pernah dipublikasikan." : "Dibuat otomatis dari nama posisi. Boleh diubah selama masih draf."}</span>{errors.slug && <span id="slug-error" className="rl-error">{errors.slug}</span>}</section>
      <div className="rl-actions">{busy ? <span className="rl-btn rl-text-btn">Batal</span> : <Link href="/recruitment/lowongan" className="rl-btn rl-text-btn">Batal</Link>}{immutableStatus ? <button className="rl-btn rl-primary" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan Perubahan"}</button> : <><button className="rl-btn" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan Draf"}</button><button className="rl-btn rl-primary" type="button" disabled={busy} onClick={() => { if (validate(payload("Aktif"))) setConfirm(true); }}>Publikasikan</button></>}</div>
      </fieldset>
    </form>
    <aside className="rl-form-aside"><section className="rl-card"><h2>Form lamaran</h2><p className="rl-muted">Pertanyaan sama untuk semua lowongan. Pelamar mengisi 3 langkah:</p><div className="rl-stack" style={{ gap: 10 }}>{[["Data diri", "Nama, WA, email, tgl lahir, domisili, pendidikan"], ["Pengalaman", "Kerja terakhir, aplikasi, ekspektasi gaji, mulai kerja, sumber info"], ["CV & kirim", "CV PDF, portofolio, alasan, persetujuan data"]].map(([title, description], index) => <div key={title} className="rl-step"><span className="rl-step-number">{index + 1}</span><div className="rl-stack" style={{ gap: 2 }}><strong style={{ fontSize: 13.5 }}>{title}</strong><span className="rl-muted" style={{ fontSize: 12.5 }}>{description}</span></div></div>)}</div></section><section className="rl-card"><h2>Pratinjau</h2><p className="rl-muted">Lihat halaman lowongan persis seperti yang dibuka pelamar di HP.</p><button className="rl-btn" style={{ minHeight: 42, fontSize: 13.5 }} type="button" onClick={() => setPreview(true)}><Icon name="phone" />Lihat sebagai pelamar</button></section><section className="rl-warning"><strong>Setelah dipublikasikan</strong><span>Link langsung aktif dan lowongan muncul di halaman karir. Link tidak bisa diubah lagi supaya yang sudah disebar tetap jalan.</span></section></aside>
    </div>
    {preview && <Modal title="Pratinjau lowongan" onClose={() => setPreview(false)} preview><JobDetails job={payload(job.status)} preview /></Modal>}
    {confirm && <ConfirmDialog title="Publikasikan lowongan?" description="Lowongan akan langsung muncul di halaman karir dan menerima lamaran. Link tidak dapat diubah setelah dipublikasikan." confirmLabel="Publikasikan" onConfirm={() => void save("Aktif")} onClose={() => setConfirm(false)} busy={busy} error={error} />}
  </div>;
}
