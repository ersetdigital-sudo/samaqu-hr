"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { FieldErrors } from "@/lib/recruitment/live/types";

export function Icon({ name, size = 16 }: { name: "back" | "plus" | "close" | "external" | "link" | "copy" | "more" | "search" | "chat" | "file" | "phone"; size?: number }) {
  const paths = { back: "m15 18-6-6 6-6", plus: "M12 5v14M5 12h14", close: "m6 6 12 12M18 6 6 18", external: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3", link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1", copy: "M9 9h12v12H9zM5 15V5a2 2 0 0 1 2-2h10", more: "M5 12h.01M12 12h.01M19 12h.01", search: "m20 20-3.5-3.5M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0", chat: "M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.4A9 9 0 1 1 21 12Z", file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8ZM14 3v5h5", phone: "M7 2h10v20H7ZM11 18h2" };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "more" ? 3.5 : 2} strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

export function Badge({ value }: { value: string }) { return <span className="rl-badge" data-tone={value}>{value}</span>; }
export function BackLink() { return <Link href="/recruitment/lowongan" className="rl-btn rl-back" aria-label="Kembali ke daftar lowongan"><Icon name="back" size={18} /></Link>; }
export function useOrigin() { const [origin, setOrigin] = useState(""); useEffect(() => { setOrigin(window.location.origin); }, []); return origin; }
export function dateLabel(value: string | null) { return value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : ""; }
export function whatsappDigits(value: string) { const digits = value.replace(/\D/g, ""); return digits.startsWith("0") ? `62${digits.slice(1)}` : digits.startsWith("8") ? `62${digits}` : digits; }
export function money(value: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value); }
export function initials(value: string) { return value.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase(); }
export function relativeTime(value: string) { const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); if (minutes < 1) return "Baru saja"; if (minutes < 60) return `${minutes} menit lalu`; if (minutes < 1440) return `${Math.floor(minutes / 60)} jam lalu`; if (minutes < 2880) return "Kemarin"; if (minutes < 43200) return `${Math.floor(minutes / 1440)} hari lalu`; return dateLabel(value); }
export function ageLabel(value: string) { const birth = new Date(`${value}T12:00:00`); if (Number.isNaN(birth.getTime())) return "—"; const now = new Date(); let age = now.getFullYear() - birth.getFullYear(); if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--; return `${age} tahun`; }

export class ApiError extends Error { fields: FieldErrors; constructor(message: string, fields: FieldErrors = {}) { super(message); this.fields = fields; } }
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers }, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(body?.error || "Permintaan gagal. Silakan coba lagi.", body?.fields);
  if (!body) throw new ApiError("Respons server tidak valid. Silakan coba lagi.");
  return body as T;
}

export function CopyButton({ value, onMessage }: { value: string; onMessage: (message: string, error?: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2200); return () => clearTimeout(timer); }, [copied]);
  return <button className="rl-btn rl-small" type="button" disabled={!value} onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); onMessage("Link berhasil disalin."); } catch { onMessage("Link tidak bisa disalin. Pilih dan salin URL secara manual.", true); } }}>{copied ? "Tersalin" : "Salin"}</button>;
}

export function Modal({ title, children, onClose, busy = false, preview = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; preview?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; const previous = document.activeElement as HTMLElement | null; dialog?.showModal(); return () => { dialog?.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className={`rl-dialog${preview ? " rl-preview-dialog" : ""}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}><div className="rl-dialog-header"><h2 id={titleId}>{title}</h2><button type="button" className="rl-btn rl-icon-btn" aria-label="Tutup dialog" onClick={onClose} disabled={busy}><Icon name="close" /></button></div>{children}</dialog>;
}
export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onClose, busy, error, danger }: { title: string; description: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; busy: boolean; error?: string; danger?: boolean }) {
  return <Modal title={title} onClose={onClose} busy={busy}><p className="rl-dialog-body">{description}</p>{error && <p role="alert" className="rl-error" style={{ marginTop: 12 }}>{error}</p>}<div className="rl-dialog-footer"><button autoFocus type="button" className="rl-btn" onClick={onClose} disabled={busy}>Batal</button><button type="button" className={`rl-btn ${danger ? "rl-danger" : "rl-primary"}`} onClick={onConfirm} disabled={busy}>{busy ? "Memproses…" : confirmLabel}</button></div></Modal>;
}
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) { return <div className="rl-error-box" role="alert"><span className="rl-error">{message}</span>{retry && <button type="button" className="rl-btn rl-small" onClick={retry}>Coba lagi</button>}</div>; }
