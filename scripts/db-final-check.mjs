#!/usr/bin/env node
/**
 * Verifikasi akhir READ-ONLY: sequence, baseline data, ACL final.
 *
 * Pakai: node scripts/db-final-check.mjs
 */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pick = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();
const dbPassword = process.env.SAMAQU_DB_PASSWORD ?? pick("SAMAQU_DB_PASSWORD") ?? "";

const client = new pg.Client({
  connectionString: `postgresql://postgres.wyfeotgzfewccmnsbcbf:${encodeURIComponent(
    dbPassword
  )}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  connectionTimeoutMillis: 15000,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

console.log("=== Sequence (data existing dipertahankan) ===");
const raw = await client.query(`
  select sequencename as sequence_name, last_value
  from pg_sequences where schemaname = 'public'
  order by sequencename
`);
console.table(raw.rows);

console.log("=== Baseline data ===");
const counts = await client.query(`
  select 'employees' t, count(*)::int c from public.employees
  union all select 'contracts', count(*)::int from public.contracts
  union all select 'contract_history', count(*)::int from public.contract_history
  union all select 'employee_status_history', count(*)::int from public.employee_status_history
`);
console.table(counts.rows);

console.log("=== ACL final (pg_class.relacl) ===");
const acl = await client.query(`
  select c.relname, coalesce(c.relacl::text,'(none)') as relacl
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('contract_history','employee_status_history')
`);
acl.rows.forEach((r) => console.log(`${r.relname}: ${r.relacl}`));

console.log("=== Privilege efektif & EXECUTE fungsi ===");
const priv = await client.query(`
  select t as tabel,
         has_table_privilege('authenticated','public.'||t,'INSERT') as auth_insert,
         has_table_privilege('authenticated','public.'||t,'SELECT') as auth_select,
         has_table_privilege('anon','public.'||t,'INSERT') as anon_insert,
         has_table_privilege('anon','public.'||t,'SELECT') as anon_select
  from (values ('contract_history'),('employee_status_history')) v(t)
`);
console.table(priv.rows);

const fn = await client.query(`
  select p.proname,
         case when p.prosecdef then 'DEFINER' else 'INVOKER' end as security,
         coalesce(array_to_string(p.proconfig,' | '),'(none)') as config,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
         pg_get_userbyid(p.proowner) as owner
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('log_contract_change','log_employee_status_change')
  order by p.proname
`);
console.table(fn.rows);

await client.end();
