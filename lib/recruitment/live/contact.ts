/** Normalisasi & diff data kontak pelamar (murni, dipakai UI dan server). */

import type { ApplicationContactInput } from "./types";
import { normalizeWhatsapp } from "./validation";

export const CONTACT_LABELS: Record<string, string> = {
  full_name: "Nama lengkap",
  whatsapp: "Nomor WhatsApp",
  email: "Email",
  city: "Kota",
};

export function normalizeContactInput(
  input: ApplicationContactInput
): ApplicationContactInput {
  return {
    full_name: input.full_name.trim(),
    whatsapp: normalizeWhatsapp(input.whatsapp.trim()),
    email: input.email.trim().toLowerCase(),
    city: input.city.trim(),
  };
}

export function contactFromApplication(application: {
  full_name: string;
  whatsapp: string;
  email: string;
  city: string;
}): ApplicationContactInput {
  return {
    full_name: application.full_name,
    whatsapp: application.whatsapp,
    email: application.email,
    city: application.city,
  };
}

export function hasContactChanges(
  current: ApplicationContactInput,
  next: ApplicationContactInput
): boolean {
  const before = normalizeContactInput(current);
  const after = normalizeContactInput(next);
  return (
    before.full_name !== after.full_name ||
    before.whatsapp !== after.whatsapp ||
    before.email !== after.email ||
    before.city !== after.city
  );
}
