#!/usr/bin/env node
/**
 * Uji transaksi RESMI lewat PostgREST dengan JWT HR Manager asli.
 *
 * Membuat user sementara (hr_manager), menjalankan alur resmi:
 *   create contract -> edit -> renew -> end
 *   reaktivasi karyawan (Nonaktif -> Aktif)
 *   perubahan status karyawan (Aktif -> Probation)
 * lalu memeriksa histori + changed_by, dan MEMBERSIHKAN semua datanya.
 *
 * Tidak menyentuh 14 karyawan / 14 kontrak existing.
 *
 * Pakai: node scripts/test-official-flows.mjs
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
  results.push({ name, ok, detail });
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
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
};

const rpc = (name, args) =>
  call(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) });

const createdUsers = [];
let employee = null;

try {
  /* --- user sementara --- */
  const email = `flow.hr.${Date.now()}@contoh.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Uji Alur HR" },
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const userId = data.user.id;
  createdUsers.push(userId);

  await admin.from("user_profiles").insert({
    id: userId,
    full_name: "Uji Alur HR",
    email,
    account_status: "Aktif",
  });
  const { data: roleRow } = await admin
    .from("roles")
    .select("id")
    .eq("name", "hr_manager")
    .single();
  await admin
    .from("user_roles")
    .insert({ user_id: userId, role_id: roleRow.id });

  const authClient = createClient(BASE, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInError } =
    await authClient.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`login: ${signInError.message}`);
  jwt = signIn.session.access_token;

  /* --- karyawan uji --- */
  const stamp = Date.now();
  employee = {
    full_name: "Karyawan Uji Histori",
    position: "QA Analyst",
    department: "Teknologi",
    location: "Remote",
    manager_id: null,
    joined_at: "2026-01-05",
    employment_type: "Kontrak",
    status: "Probation",
    gender: "Laki-laki",
    birth_place: "Bandung",
    birth_date: "1995-02-10",
    address: "Jl. Uji No. 1",
    nik: String(stamp).padStart(16, "0").slice(-16),
    personal_email: `uji.${stamp}@mail.invalid`,
    work_email: `uji.${stamp}@samaqu.invalid`,
    phone: "0800000000",
    emergency_name: "Kontak Uji",
    emergency_relation: "Saudara",
    emergency_phone: "0800000001",
    probation_start: "2026-01-05",
    probation_end: "2026-04-05",
  };

  const inserted = await call("employees", {
    method: "POST",
    body: JSON.stringify(employee),
  });
  if (inserted.status !== 201) {
    throw new Error(`insert karyawan uji: ${inserted.status} ${JSON.stringify(inserted.body)}`);
  }
  const employeeId = inserted.body[0].id;
  console.log(`\nKaryawan uji: ${employeeId}\n`);

  /* --- 1. create contract --- */
  const create = await call("contracts", {
    method: "POST",
    body: JSON.stringify({
      employee_id: employeeId,
      start_date: "2026-02-01",
      end_date: "2026-08-01",
      employment_type: "Kontrak",
      note: "kontrak uji create",
    }),
  });
  check("create contract resmi (201)", create.status === 201, `HTTP ${create.status}`);
  const contractId = create.body?.[0]?.id;

  /* --- 2. edit contract --- */
  const edit = await call(`contracts?id=eq.${contractId}`, {
    method: "PATCH",
    body: JSON.stringify({ note: "kontrak uji edit" }),
  });
  check("edit contract resmi (200)", edit.status === 200, `HTTP ${edit.status}`);

  /* --- 3. renewal --- */
  const renew = await rpc("renew_contract", {
    p_previous_id: contractId,
    p_start_date: null,
    p_end_date: "2027-02-01",
    p_note: "perpanjangan uji",
    p_gap_reason: null,
  });
  check("renewal resmi (200)", renew.status === 200, `HTTP ${renew.status}`);
  const renewedId = renew.body?.id;

  /* --- 4. end contract --- */
  const end = await call(`contracts?id=eq.${renewedId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "Berakhir", end_date: "2026-12-01" }),
  });
  check("end contract resmi (200)", end.status === 200, `HTTP ${end.status}`);

  /* --- 5. reaktivasi karyawan --- */
  const deactivate = await call(`employees?id=eq.${employeeId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "Nonaktif" }),
  });
  check("nonaktifkan karyawan uji (200)", deactivate.status === 200, `HTTP ${deactivate.status}`);

  const reactivate = await rpc("reactivate_employee", {
    p_employee_id: employeeId,
    p_reason: "uji reaktivasi histori",
  });
  check("reaktivasi resmi (200)", reactivate.status === 200, `HTTP ${reactivate.status}`);

  /* --- 6. perubahan status karyawan --- */
  const toProbation = await call(`employees?id=eq.${employeeId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "Probation" }),
  });
  check("perubahan status karyawan (200)", toProbation.status === 200, `HTTP ${toProbation.status}`);

  /* --- histori kontrak --- */
  const ch = await call(
    `contract_history?employee_id=eq.${employeeId}&select=event,changed_by,contract_id&order=id.asc`
  );
  const events = (ch.body ?? []).map((row) => row.event);
  check("contract_history tercatat otomatis (>= 4 baris)", ch.body?.length >= 4, `rows=${ch.body?.length} events=${events.join(",")}`);
  check(
    "event create tercatat",
    events.includes("Dibuat"),
    `events=${events.join(",")}`
  );
  check(
    "event edit/diubah tercatat",
    events.filter((e) => e === "Diubah").length >= 1,
    `events=${events.join(",")}`
  );
  check("event renew tercatat", events.includes("Diperpanjang"), `events=${events.join(",")}`);
  check(
    "event end tercatat",
    events.filter((e) => e === "Diakhiri").length >= 1,
    `events=${events.join(",")}`
  );

  const wrongActor = (ch.body ?? []).filter(
    (row) => row.changed_by !== null && row.changed_by !== userId
  );
  check(
    "changed_by kontrak = UUID HR asli",
    wrongActor.length === 0 && (ch.body ?? []).some((r) => r.changed_by === userId),
    `actor=${userId.slice(0, 8)} mismatches=${wrongActor.length}`
  );

  /* --- histori status --- */
  const sh = await call(
    `employee_status_history?employee_id=eq.${employeeId}&select=action,from_status,to_status,changed_by&order=id.asc`
  );
  const actions = (sh.body ?? []).map((r) => r.action);
  check("employee_status_history tercatat (>= 3 baris)", sh.body?.length >= 3, `rows=${sh.body?.length}`);
  check("aksi Reaktivasi tercatat", actions.includes("Reaktivasi"), `actions=${actions.join(",")}`);
  check(
    "aksi Perubahan Status tercatat",
    actions.filter((a) => a === "Perubahan Status").length >= 2,
    `actions=${actions.join(",")}`
  );

  const wrongStatusActor = (sh.body ?? []).filter(
    (row) => row.changed_by !== null && row.changed_by !== userId
  );
  check(
    "changed_by status = UUID HR asli",
    wrongStatusActor.length === 0 && (sh.body ?? []).some((r) => r.changed_by === userId),
    `mismatches=${wrongStatusActor.length}`
  );

  /* --- SELECT history tetap berfungsi untuk HR --- */
  const crh = await call("contract_history?select=id&limit=1");
  const erh = await call("employee_status_history?select=id&limit=1");
  check("HR Manager SELECT contract_history (200)", crh.status === 200, `HTTP ${crh.status}`);
  check("HR Manager SELECT employee_status_history (200)", erh.status === 200, `HTTP ${erh.status}`);

  console.log(`\ncontract_history sample:`);
  (ch.body ?? []).forEach((r) =>
    console.log(`  ${r.event.padEnd(13)} changed_by=${r.changed_by?.slice(0, 8)}`)
  );
  console.log(`employee_status_history sample:`);
  (sh.body ?? []).forEach((r) =>
    console.log(`  ${r.action.padEnd(16)} ${r.from_status} → ${r.to_status}  changed_by=${r.changed_by?.slice(0, 8)}`)
  );
} catch (error) {
  check("eksekusi uji", false, error.message);
} finally {
  /* --- cleanup: hapus data uji (cascade ke histori) --- */
  if (employee) {
    try {
      const { data: found } = await admin
        .from("employees")
        .select("id")
        .eq("work_email", employee.work_email)
        .maybeSingle();
      if (found) {
        await admin.from("employee_status_history").delete().eq("employee_id", found.id);
        await admin.from("contract_history").delete().eq("employee_id", found.id);
        await admin.from("contracts").delete().eq("employee_id", found.id);
        await admin.from("employees").delete().eq("id", found.id);
      }
    } catch (error) {
      console.error(`[cleanup] karyawan uji: ${error.message}`);
    }
  }

  for (const id of createdUsers) {
    await admin.from("user_access_history").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id);
  }

  const { count: emp } = await admin.from("employees").select("id", { count: "exact", head: true });
  const { count: con } = await admin.from("contracts").select("id", { count: "exact", head: true });
  const { count: hist } = await admin.from("contract_history").select("id", { count: "exact", head: true });
  const { count: shist } = await admin.from("employee_status_history").select("id", { count: "exact", head: true });

  console.log(`\nbaseline akhir: employees=${emp} contracts=${con} contract_history=${hist} status_history=${shist}`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nGAGAL: ${failed} dari ${results.length}`);
  process.exit(failed ? 1 : 0);
}
