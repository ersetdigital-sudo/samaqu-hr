#!/usr/bin/env node
/**
 * Audit READ-ONLY hak akses tabel histori HRIS Samaqu.
 *
 * Hanya menjalankan SELECT pada katalog (pg_class, pg_proc, pg_policy, dst).
 * Tidak ada DDL/DML. Butuh service role key di .env.local.
 *
 * Pakai: node scripts/audit-history-acl.mjs
 */

import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pick = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();

const URL_BASE = pick("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = pick("SUPABASE_SERVICE_ROLE_KEY");

if (!URL_BASE || !SERVICE_KEY) {
  console.error("Butuh NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local");
  process.exit(2);
}

const query = async (sql) => {
  const response = await fetch(`${URL_BASE}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  return { status: response.status, body: text };
};

const result = await query("select 1 as ok");
console.log("probe rpc exec_sql:", result.status, result.body.slice(0, 300));
