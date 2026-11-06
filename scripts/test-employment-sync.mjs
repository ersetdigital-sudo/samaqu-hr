#!/usr/bin/env node
/**
 * Uji jalur resmi sync_employee_employment_type (employment_type + histori),
 * lalu bersihkan data uji.
 *
 * Pakai: node scripts/test-employment-sync.mjs
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pick = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();

const BASE = pick("NEXT_PUBLIC_SUPABASE_URL");
const ANON = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE = pick("SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(BASE, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const password = randomBytes(18).toString("base64url");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

let jwt = null;
const call = async (path, init = {}) => {
  const response = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${jwt ?? ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body };
};

const createdUsers = [];
let workEmail = null;

try {
  const email = `sync.hr.${Date.now()}@contoh.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: "Uji Sync HR" },
  });
  if (error) throw new Error(error.message);
  const userId = data.user.id;
  createdUsers.push(userId);

  await admin.from("user_profiles").insert({
    id: userId, full_name: "Uji Sync HR", email, account_status: "Aktif",
  });
  const { data: roleRow } = await admin.from("roles").select("id").eq("name", "hr_manager").single();
  await admin.from("user_roles").insert({ user_id: userId, role_id: roleRow.id });

  const authClient = createClient(BASE, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInError } =
    await authClient.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(signInError.message);
  jwt = signIn.session.access_token;

  const stamp = Date.now();
  workEmail = `sync.${stamp}@samaqu.invalid`;
  const created = await call("employees", {
    method: "POST",
    body: JSON.stringify({
      full_name: "Karyawan Uji Sync",
      position: "QA Analyst",
      department: "Teknologi",
      location: "Remote",
      manager_id: null,
      joined_at: "2026-01-05",
      employment_type: "Kontrak",
      status: "Aktif",
      gender: "Laki-laki",
      birth_place: "Bandung",
      birth_date: "1995-02-10",
      address: "Jl. Uji No. 2",
      nik: String(stamp).padStart(16, "0").slice(-16),
      personal_email: `syncp.${stamp}@mail.invalid`,
      work_email: workEmail,
      phone: "0800000002",
      emergency_name: "Kontak Uji",
      emergency_relation: "Saudara",
      emergency_phone: "0800000003",
      probation_start: null,
      probation_end: null,
    }),
  });
  if (created.status !== 201) throw new Error(`karyawan: ${created.status}`);
  const employeeId = created.body[0].id;
  console.log(`\nKaryawan uji: ${employeeId}\n`);

  const contract = await call("contracts", {
    method: "POST",
    body: JSON.stringify({
      employee_id: employeeId,
      start_date: "2026-02-01",
      end_date: "2026-08-01",
      employment_type: "Kontrak",
      note: "kontrak uji sync",
    }),
  });
  check("kontrak uji dibuat", contract.status === 201, `HTTP ${contract.status}`);
  const contractId = contract.body?.[0]?.id;

  const before = await call(`employees?id=eq.${employeeId}&select=employment_type`);
  const beforeType = before.body?.[0]?.employment_type;

  // Catatan: target "Tetap" ditolak bila masih ada kontrak Aktif bertanggal
  // akhir (aturan bisnis existing, tidak diubah). Di sini diuji Kontrak → Magang.
  const sync = await call("rpc/sync_employee_employment_type", {
    method: "POST",
    body: JSON.stringify({
      p_employee_id: employeeId,
      p_expected_type: beforeType,
      p_new_type: "Magang",
      p_contract_id: contractId,
      p_note: "uji sinkronisasi histori",
    }),
  });
  check("sync_employee_employment_type resmi (200)", sync.status === 200, `HTTP ${sync.status} ${sync.status !== 200 ? JSON.stringify(sync.body).slice(0, 300) : ""}`);

  const after = await call(`employees?id=eq.${employeeId}&select=employment_type`);
  check(
    "employment_type berubah ke Magang",
    after.body?.[0]?.employment_type === "Magang",
    `${beforeType} → ${after.body?.[0]?.employment_type}`
  );

  const hist = await call(
    `contract_history?employee_id=eq.${employeeId}&select=event,changes,changed_by&order=id.desc&limit=1`
  );
  const last = hist.body?.[0];
  check(
    "histori sinkronisasi tercatat",
    Boolean(last) && JSON.stringify(last.changes).includes("employment_type"),
    `${last?.event}`
  );
  check(
    "changed_by sinkronisasi = UUID HR asli",
    last?.changed_by === userId,
    `${last?.changed_by?.slice(0, 8)}`
  );
} catch (error) {
  check("eksekusi uji sync", false, error.message);
} finally {
  if (workEmail) {
    const { data: found } = await admin.from("employees").select("id").eq("work_email", workEmail).maybeSingle();
    if (found) {
      await admin.from("contract_history").delete().eq("employee_id", found.id);
      await admin.from("contracts").delete().eq("employee_id", found.id);
      await admin.from("employees").delete().eq("id", found.id);
    }
  }
  for (const id of createdUsers) {
    await admin.from("user_access_history").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id);
  }

  const { count: emp } = await admin.from("employees").select("id", { count: "exact", head: true });
  const { count: con } = await admin.from("contracts").select("id", { count: "exact", head: true });
  const { count: hist } = await admin.from("contract_history").select("id", { count: "exact", head: true });
  console.log(`\nbaseline akhir: employees=${emp} contracts=${con} contract_history=${hist}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nGAGAL: ${failed} dari ${results.length}`);
  process.exit(failed ? 1 : 0);
}
