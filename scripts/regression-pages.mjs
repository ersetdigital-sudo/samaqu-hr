#!/usr/bin/env node
/**
 * Regression halaman utama dengan sesi HR Manager sementara.
 * Membuka halaman internal dan memastikan tidak ada error 5xx / error boundary.
 *
 * Pakai: node scripts/regression-pages.mjs  (butuh dev server di :3000)
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pick = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();

const BASE = pick("NEXT_PUBLIC_SUPABASE_URL");
const ANON = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE = pick("SUPABASE_SERVICE_ROLE_KEY");
const APP = process.env.APP_URL ?? "http://localhost:3000";

const admin = createClient(BASE, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const password = randomBytes(18).toString("base64url");
const created = [];
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

try {
  const email = `regress.${Date.now()}@contoh.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: "Regresi HR" },
  });
  if (error) throw new Error(error.message);
  const userId = data.user.id;
  created.push(userId);

  await admin.from("user_profiles").insert({
    id: userId, full_name: "Regresi HR", email, account_status: "Aktif",
  });
  const { data: roleRow } = await admin.from("roles").select("id").eq("name", "hr_manager").single();
  await admin.from("user_roles").insert({ user_id: userId, role_id: roleRow.id });

  const jar = new Map();
  const client = createServerClient(BASE, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(signInError.message);
  const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");

  const pages = [
    "/",
    "/employees/direktori",
    "/employees/kontrak",
    "/recruitment/overview",
    "/recruitment/lowongan",
    "/recruitment/kandidat",
    "/recruitment/pipeline",
    "/recruitment/jadwal",
    "/recruitment/onboarding",
    "/recruitment/laporan",
    "/knowledge-hub/beranda",
    "/knowledge-hub/semua-dokumen",
    "/settings/users",
  ];

  for (const path of pages) {
    const response = await fetch(APP + path, {
      headers: { cookie },
      signal: AbortSignal.timeout(60000),
    });
    const body = await response.text();
    const broken =
      response.status >= 500 ||
      body.includes("Data rekrutmen gagal dimuat") ||
      body.includes("Application error");
    check(`halaman ${path}`, response.status === 200 && !broken, `HTTP ${response.status}`);
  }
} catch (error) {
  check("regression eksekusi", false, error.message);
} finally {
  for (const id of created) {
    await admin.from("user_access_history").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id);
  }
  const failed = results.filter((ok) => !ok).length;
  console.log(`\nGAGAL: ${failed} dari ${results.length}`);
  process.exit(failed ? 1 : 0);
}
