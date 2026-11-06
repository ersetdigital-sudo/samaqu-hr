#!/usr/bin/env node
/**
 * Audit READ-ONLY : cek apakah authenticated / anon bisa INSERT langsung
 * ke contract_history & employee_status_history lewat PostgREST (JWT user).
 *
 * Tidak mengubah satu baris pun: request INSERT sengaja dibuat GAGAL di
 * level constraint (kolom wajib kosong) sehingga bila hak INSERT ada, error
 * yang muncul adalah constraint/NULL, bukan 401/403. Bila akses dicabut,
 * PostgREST menolak dengan 401/403 sebelum menyentuh tabel.
 *
 * Pakai: node scripts/probe-history-insert.mjs
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pick = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();

const URL_BASE = pick("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = pick("SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(URL_BASE, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const password = randomBytes(18).toString("base64url");
const created = [];

async function tempUser(role, name) {
  const email = `probe.${role}.${Date.now()}@contoh.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) throw new Error(`createUser ${role}: ${error.message}`);
  const id = data.user.id;
  created.push(id);

  const { error: pErr } = await admin.from("user_profiles").insert({
    id,
    full_name: name,
    email,
    account_status: "Aktif",
  });
  if (pErr) throw new Error(`profil ${role}: ${pErr.message}`);

  const { data: roleRow, error: rErr } = await admin
    .from("roles")
    .select("id")
    .eq("name", role)
    .single();
  if (rErr) throw new Error(`role ${role}: ${rErr.message}`);

  const { error: lErr } = await admin
    .from("user_roles")
    .insert({ user_id: id, role_id: roleRow.id });
  if (lErr) throw new Error(`user_roles ${role}: ${lErr.message}`);

  return { id, email };
}

async function token(email) {
  const client = createClient(URL_BASE, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return data.session.access_token;
}

/** INSERT sengaja invalid (kolom wajib kosong) ke tabel histori. */
async function tryInsert(table, jwt) {
  const headers = { apikey: ANON_KEY, "Content-Type": "application/json" };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  const response = await fetch(`${URL_BASE}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify([{}]),
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let code = "";
  try {
    code = JSON.parse(text).code ?? "";
  } catch {
    code = "";
  }
  return { status: response.status, code, body: text.slice(0, 220) };
}

const levels = ["contract_history", "employee_status_history"];
const out = [];

try {
  const hr = await tempUser("hr_manager", "Probe HR");
  const rec = await tempUser("recruiter", "Probe Recruiter");
  const hrJwt = await token(hr.email);
  const recJwt = await token(rec.email);

  for (const table of levels) {
    out.push(["anon", table, await tryInsert(table, null)]);
    out.push(["hr_manager", table, await tryInsert(table, hrJwt)]);
    out.push(["recruiter", table, await tryInsert(table, recJwt)]);
  }
} finally {
  for (const id of created) {
    await admin.from("user_access_history").delete().eq("user_id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error(`[cleanup] ${id}: ${error.message}`);
  }
}

console.log("\nrole           | tabel                     | HTTP | kode  | verdict");
console.log("-".repeat(96));
for (const [role, table, r] of out) {
  const denied = r.status === 401 || r.status === 403 || r.code === "42501";
  console.log(
    `${role.padEnd(14)} | ${table.padEnd(25)} | ${String(r.status).padEnd(4)} | ${(r.code || "-").padEnd(5)} | ${denied ? "DITOLAK" : "MASIH PUNYA HAK"}`
  );
  if (!denied) console.log(`   body: ${r.body}`);
}
