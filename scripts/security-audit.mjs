#!/usr/bin/env node
/**
 * Audit keamanan otomatis HRIS Samaqu.
 *
 * Cakupan: sesi & redirect, RBAC halaman, guard API, RLS dengan JWT pengguna,
 * guard role di fungsi SECURITY DEFINER, akun Nonaktif, dan perlindungan
 * employment_type.
 *
 * Skrip membuat akun sementara (admin/hr_manager/recruiter/employee) lalu
 * menghapusnya kembali. Data karyawan/kontrak existing tidak diubah.
 *
 * Pakai:  node scripts/security-audit.mjs
 * Butuh:  .env.local (URL, anon key, service role key) + server dev aktif.
 *         APP_URL=http://localhost:3000 (bisa dioverride).
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pick = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();

const SUPABASE_URL = pick("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = pick("SUPABASE_SERVICE_ROLE_KEY");
const APP = process.env.APP_URL ?? "http://localhost:3000";

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error(
    "Butuh NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, dan SUPABASE_SUPABASE_SERVICE_ROLE_KEY di .env.local"
  );
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
const info = [];
const check = (name, ok, detail = "") => {
  const line = `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`;
  results.push(line);
  console.log(line);
};

const signal = () => AbortSignal.timeout(30000);

/* ------------------------------------------------------------------ */
/* Akun sementara                                                      */
/* ------------------------------------------------------------------ */
const password = randomBytes(18).toString("base64url");
const createdUsers = [];
const toRestore = [];

async function createTempUser(role, fullName) {
  const email = `audit.${role}.${Date.now()}@contoh.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`createUser ${role}: ${error.message}`);

  const id = data.user.id;
  createdUsers.push(id);

  const { error: profileError } = await admin.from("user_profiles").insert({
    id,
    full_name: fullName,
    email,
    account_status: "Aktif",
  });
  if (profileError) throw new Error(`profil ${role}: ${profileError.message}`);

  const { data: roleRow, error: roleError } = await admin
    .from("roles")
    .select("id")
    .eq("name", role)
    .single();
  if (roleError) throw new Error(`role ${role}: ${roleError.message}`);

  const { error: linkError } = await admin
    .from("user_roles")
    .insert({ user_id: id, role_id: roleRow.id });
  if (linkError) throw new Error(`user_roles ${role}: ${linkError.message}`);

  return { id, email };
}

async function loginAs(email) {
  const jar = new Map();
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);

  return {
    cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
    token: data.session.access_token,
  };
}

/* ------------------------------------------------------------------ */
/* HTTP helper                                                         */
/* ------------------------------------------------------------------ */
async function page(path, cookie, follow = true) {
  const r = await fetch(APP + path, {
    redirect: follow ? "follow" : "manual",
    headers: cookie ? { cookie } : {},
    signal: signal(),
  });
  const body = r.status === 200 ? await r.text() : "";
  return { status: r.status, url: r.url, location: r.headers.get("location"), body };
}

async function api(path, cookie) {
  const r = await fetch(APP + path, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
    signal: signal(),
  });
  return { status: r.status };
}

/** Jumlah baris yang lolos RLS untuk JWT pengguna tertentu. */
async function restCount(table, token) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
    signal: signal(),
  });
  const range = r.headers.get("content-range") ?? "";
  const count = range.includes("/") ? Number(range.split("/")[1]) : NaN;
  return { status: r.status, count };
}

/** Panggil RPC sebagai anon, JWT pengguna, atau service role. */
async function rpc(name, args, identity) {
  const bearer = identity === "service" ? SERVICE_KEY : identity;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: identity === "service" ? SERVICE_KEY : ANON_KEY,
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: signal(),
  });
  const text = await r.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

const message = (body) => String(body?.message ?? body ?? "");

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */
console.log(`Audit keamanan ${APP} → ${new URL(SUPABASE_URL).hostname}\n`);

try {
  const users = {
    admin: await createTempUser("admin", "Audit Admin"),
    hr: await createTempUser("hr_manager", "Audit HR Manager"),
    recruiter: await createTempUser("recruiter", "Audit Recruiter"),
    employee: await createTempUser("employee", "Audit Employee"),
  };

  const session = {};
  for (const [key, user] of Object.entries(users)) {
    session[key] = await loginAs(user.email);
  }

  /* 1. Tanpa sesi */
  const anonHome = await page("/", null, false);
  check(
    "tanpa sesi: halaman internal dialihkan ke /login",
    anonHome.status === 307 && (anonHome.location ?? "").includes("/login"),
    `${anonHome.status} ${anonHome.location ?? ""}`
  );
  const anonApi = await api("/api/employees", null);
  check(
    "tanpa sesi: API data ditolak",
    anonApi.status === 401 || anonApi.status === 307,
    String(anonApi.status)
  );
  const anonRpc = await rpc("renew_contract", {
    p_previous_id: "00000000-0000-0000-0000-000000000000",
    p_start_date: "2026-01-01",
    p_end_date: "2026-12-31",
    p_note: null,
    p_gap_reason: null,
  }, ANON_KEY);
  check(
    "tanpa sesi: RPC sensitif tidak bisa dieksekusi",
    anonRpc.status >= 400,
    `${anonRpc.status} ${message(anonRpc.body)}`
  );

  /* 2. Admin */
  const adminUsersPage = await page("/settings/users", session.admin.cookie);
  check(
    "admin: halaman Pengguna & Peran tampil",
    adminUsersPage.status === 200 && adminUsersPage.body.includes("Pengguna"),
    String(adminUsersPage.status)
  );
  check(
    "admin: /api/users dapat diakses",
    (await api("/api/users", session.admin.cookie)).status === 200
  );
  const adminEmployees = await page("/employees/direktori", session.admin.cookie);
  check(
    "admin: modul karyawan tetap dibatasi",
    adminEmployees.body.includes("Akses ditolak")
  );

  /* 3. HR Manager */
  const hrDirectory = await page("/employees/direktori", session.hr.cookie);
  check(
    "hr_manager: Direktori Karyawan tampil",
    hrDirectory.status === 200 && hrDirectory.body.includes("Direktori Karyawan"),
    String(hrDirectory.status)
  );
  const hrEmployees = await restCount("employees", session.hr.token);
  check(
    "hr_manager: RLS memberi 14 karyawan",
    hrEmployees.count === 14,
    `${hrEmployees.status} count=${hrEmployees.count}`
  );
  const hrContracts = await restCount("contracts", session.hr.token);
  check(
    "hr_manager: RLS memberi 14 kontrak",
    hrContracts.count === 14,
    `${hrContracts.status} count=${hrContracts.count}`
  );
  check(
    "hr_manager: /api/users ditolak 403",
    (await api("/api/users", session.hr.cookie)).status === 403
  );
  const hrUsersPage = await page("/settings/users", session.hr.cookie);
  check(
    "hr_manager: halaman pengguna ditolak",
    hrUsersPage.body.includes("Akses ditolak")
  );
  const hrRpc = await rpc(
    "reactivate_employee",
    { p_employee_id: "SQ-EMP-9999", p_reason: "uji audit" },
    session.hr.token
  );
  check(
    "hr_manager: RPC reaktivasi lolos guard role (gagal karena data uji tidak ada)",
    hrRpc.status >= 400 && /tidak ditemukan/i.test(message(hrRpc.body)),
    `${hrRpc.status} ${message(hrRpc.body)}`
  );

  /* 4. Recruiter */
  const recruiterRows = await restCount("employees", session.recruiter.token);
  check(
    "recruiter: RLS tidak memberi data karyawan",
    recruiterRows.count === 0,
    `${recruiterRows.status} count=${recruiterRows.count}`
  );
  check(
    "recruiter: /api/employees ditolak 403",
    (await api("/api/employees", session.recruiter.cookie)).status === 403
  );
  const recruiterPage = await page("/employees/direktori", session.recruiter.cookie);
  check("recruiter: Direktori ditolak", recruiterPage.body.includes("Akses ditolak"));
  const recruiterRpc = await rpc(
    "reactivate_employee",
    { p_employee_id: "SQ-EMP-9999", p_reason: "uji audit" },
    session.recruiter.token
  );
  check(
    "recruiter: RPC reaktivasi ditolak di database",
    recruiterRpc.status >= 400 && /akses ditolak/i.test(message(recruiterRpc.body)),
    `${recruiterRpc.status} ${message(recruiterRpc.body)}`
  );

  /* 5. Employee */
  const employeeHome = await page("/", session.employee.cookie);
  check(
    "employee: dashboard tampil",
    employeeHome.status === 200 && employeeHome.body.includes("Selamat pagi"),
    String(employeeHome.status)
  );
  const employeePage = await page("/employees/direktori", session.employee.cookie);
  check("employee: Direktori ditolak", employeePage.body.includes("Akses ditolak"));
  check(
    "employee: /api/employees ditolak 403",
    (await api("/api/employees", session.employee.cookie)).status === 403
  );

  /* 6. Service role tidak bisa menyamar sebagai pengguna */
  const serviceRpc = await rpc(
    "reactivate_employee",
    { p_employee_id: "SQ-EMP-9999", p_reason: "uji audit" },
    "service"
  );
  check(
    "service role: RPC ditolak (auth.uid() kosong tidak dianggap HR)",
    serviceRpc.status >= 400 && /akses ditolak/i.test(message(serviceRpc.body)),
    `${serviceRpc.status} ${message(serviceRpc.body)}`
  );

  /* 7. employment_type tidak bisa diubah langsung lewat database */
  const { data: before } = await admin
    .from("employees")
    .select("employment_type")
    .eq("id", "SQ-EMP-0001")
    .single();
  const target = before.employment_type === "Tetap" ? "Kontrak" : "Tetap";
  const patch = await fetch(
    `${SUPABASE_URL}/rest/v1/employees?id=eq.SQ-EMP-0001`,
    {
      method: "PATCH",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${session.hr.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ employment_type: target }),
      signal: signal(),
    }
  );
  const { data: after } = await admin
    .from("employees")
    .select("employment_type")
    .eq("id", "SQ-EMP-0001")
    .single();
  check(
    "employment_type hanya bisa diubah lewat jalur resmi Kontrak",
    patch.status >= 400 && after.employment_type === before.employment_type,
    `${patch.status} ${before.employment_type} → ${after.employment_type}`
  );

  /* 8. Akun Nonaktif kehilangan seluruh akses internal */
  await admin
    .from("user_profiles")
    .update({ account_status: "Nonaktif" })
    .eq("id", users.employee.id);
  toRestore.push(users.employee.id);

  // Halaman dirender sebagai shell lalu dialihkan ke login; yang diuji adalah
  // tidak adanya data terlindungi + tidak ada akses API + RLS menolak.
  const disabledHome = await page("/", session.employee.cookie);
  const redirectHint = /NEXT_REDIRECT|%2Flogin|"\/login"/.test(disabledHome.body);
  check(
    "akun Nonaktif: tidak menerima data dashboard",
    !disabledHome.body.includes("Selamat pagi") &&
      !disabledHome.body.includes("Modul HRIS"),
    `status=${disabledHome.status} redirectHint=${redirectHint}`
  );
  info.push(
    `Halaman akun Nonaktif: HTTP ${disabledHome.status} (shell streaming), penanda redirect ke /login: ${redirectHint}. Redirect akhir diverifikasi di browser.`
  );
  const disabledSession = await api("/api/auth/session", session.employee.cookie);
  check(
    "akun Nonaktif: sesi aplikasi tidak valid (401)",
    disabledSession.status === 401,
    String(disabledSession.status)
  );
  const disabledApi = await api("/api/employees", session.employee.cookie);
  check(
    "akun Nonaktif: API data ditolak",
    disabledApi.status === 401 || disabledApi.status === 307,
    String(disabledApi.status)
  );
  const disabledRows = await restCount("employees", session.employee.token);
  check(
    "akun Nonaktif: RLS tidak memberi satu baris pun",
    disabledRows.count === 0,
    `count=${disabledRows.count}`
  );

  await admin
    .from("user_profiles")
    .update({ account_status: "Aktif" })
    .eq("id", users.employee.id);
  toRestore.length = 0;
} finally {
  for (const id of toRestore) {
    await admin
      .from("user_profiles")
      .update({ account_status: "Aktif" })
      .eq("id", id);
  }

  for (const id of createdUsers) {
    await admin.from("user_access_history").delete().eq("user_id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error(`[cleanup] gagal hapus ${id}: ${error.message}`);
  }

  const { count: leftoverProfiles } = await admin
    .from("user_profiles")
    .select("id", { count: "exact", head: true })
    .in("id", createdUsers.length ? createdUsers : ["00000000-0000-0000-0000-000000000000"]);
  const { count: employees } = await admin
    .from("employees")
    .select("id", { count: "exact", head: true });
  const { count: contracts } = await admin
    .from("contracts")
    .select("id", { count: "exact", head: true });

  check("cleanup: akun uji terhapus", (leftoverProfiles ?? 0) === 0, String(leftoverProfiles));
  check(
    "data existing utuh (14 karyawan / 14 kontrak)",
    employees === 14 && contracts === 14,
    `${employees}/${contracts}`
  );

  if (info.length) {
    console.log("");
    info.forEach((line) => console.log(`INFO  ${line}`));
  }

  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\nGAGAL: ${failed} dari ${results.length}`);
  process.exit(failed ? 1 : 0);
}
