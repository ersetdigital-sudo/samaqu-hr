"use client";

import { useState } from "react";
import {
  hasContactChanges,
  normalizeContactInput,
} from "@/lib/recruitment/live/contact";
import type {
  ApplicationContactInput,
  FieldErrors,
} from "@/lib/recruitment/live/types";
import { validateApplicationContact } from "@/lib/recruitment/live/validation";
import { ErrorBox, Modal } from "./ui";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="text-[11px] mt-1" style={{ color: "var(--bad)" }}>
      {message}
    </div>
  );
}

export function ApplicationContactForm({
  applicationId,
  initial,
  onClose,
  onSaved,
}: {
  applicationId: string;
  initial: ApplicationContactInput;
  onClose: () => void;
  onSaved: (contact: ApplicationContactInput) => void;
}) {
  const [form, setForm] = useState<ApplicationContactInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty = hasContactChanges(initial, form);

  const set = (key: keyof ApplicationContactInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validateField = (key: keyof ApplicationContactInput) => {
    const next = validateApplicationContact(normalizeContactInput(form));
    setErrors((current) => {
      const merged = { ...current };
      if (next[key]) merged[key] = next[key];
      else delete merged[key];
      return merged;
    });
  };

  const submit = async () => {
    const normalized = normalizeContactInput(form);
    const nextErrors = validateApplicationContact(normalized);
    setErrors(nextErrors);
    setFormError("");

    if (Object.keys(nextErrors).length > 0) {
      setFormError("Periksa kembali field yang ditandai merah.");
      return;
    }
    if (!hasContactChanges(initial, normalized)) {
      setFormError("Tidak ada perubahan data.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/recruitment/applications/${applicationId}/contact`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(normalized),
        }
      );
      const data = (await response.json().catch(() => null)) as {
        contact?: ApplicationContactInput;
        error?: string;
        errors?: FieldErrors;
      } | null;

      if (!response.ok || !data?.contact) {
        if (data?.errors) setErrors(data.errors);
        throw new Error(data?.error ?? "Gagal menyimpan data pelamar");
      }
      onSaved(data.contact);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Gagal menyimpan data pelamar"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Ubah Data Pelamar" onClose={onClose} busy={saving}>
      {formError && <ErrorBox message={formError} />}
      <div className="rl-fields-grid">
        <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="contact-name">Nama lengkap *</label>
          <input
            id="contact-name"
            className="rl-input"
            maxLength={150}
            value={form.full_name}
            disabled={saving}
            onChange={(event) => set("full_name", event.target.value)}
            onBlur={() => validateField("full_name")}
            aria-invalid={Boolean(errors.full_name)}
          />
          <FieldError message={errors.full_name} />
        </div>
        <div className="rl-field">
          <label htmlFor="contact-city">Kota *</label>
          <input
            id="contact-city"
            className="rl-input"
            maxLength={100}
            value={form.city}
            disabled={saving}
            onChange={(event) => set("city", event.target.value)}
            onBlur={() => validateField("city")}
            aria-invalid={Boolean(errors.city)}
          />
          <FieldError message={errors.city} />
        </div>
        <div className="rl-field">
          <label htmlFor="contact-whatsapp">Nomor WhatsApp *</label>
          <input
            id="contact-whatsapp"
            className="rl-input"
            inputMode="tel"
            value={form.whatsapp}
            disabled={saving}
            onChange={(event) => set("whatsapp", event.target.value)}
            onBlur={() => validateField("whatsapp")}
            aria-invalid={Boolean(errors.whatsapp)}
          />
          <FieldError message={errors.whatsapp} />
        </div>
        <div className="rl-field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="contact-email">Email *</label>
          <input
            id="contact-email"
            className="rl-input"
            type="email"
            maxLength={254}
            value={form.email}
            disabled={saving}
            onChange={(event) => set("email", event.target.value)}
            onBlur={() => validateField("email")}
            aria-invalid={Boolean(errors.email)}
          />
          <FieldError message={errors.email} />
        </div>
      </div>
      <p className="sub text-[11px] mt-3">
        Hanya nama, WhatsApp, email, dan kota yang berubah. Tahap, catatan, dan
        data lain tetap.
      </p>
      <div className="rl-actions">
        <button
          type="button"
          className="rl-btn"
          onClick={onClose}
          disabled={saving}
        >
          Batal
        </button>
        <button
          type="button"
          className="rl-btn rl-primary"
          onClick={() => void submit()}
          disabled={saving || !dirty}
        >
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </Modal>
  );
}
