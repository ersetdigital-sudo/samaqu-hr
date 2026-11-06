#!/usr/bin/env node
/**
 * Pra-eksekusi READ-ONLY: owner fungsi, trigger terpasang, policy INSERT lain,
 * hak INSERT authenticated.
 *
 * Pakai: node scripts/db-precheck.mjs
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

console.log("=== OWNER & PROSECDEF fungsi trigger ===");
const owners = await client.query(`
  select p.proname,
         pg_get_userbyid(p.proowner) as owner,
         p.prosecdef as security_definer,
         coalesce(array_to_string(p.proconfig, ' | '), '(none)') as config
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname in ('log_contract_change','log_employee_status_change')
`);
console.table(owners.rows);

console.log("=== TRIGGER terpasang (semua di public) ===");
const trg = await client.query(`
  select c.relname as table, t.tgname, p.proname as fn,
         case t.tgenabled when 'O' then 'ENABLED' else t.tgenabled end as state
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where n.nspname='public' and not t.tgisinternal
  order by c.relname, t.tgname
`);
console.table(trg.rows);

console.log("=== SEMUA policy di kedua tabel ===");
const pol = await client.query(`
  select tablename, policyname, cmd, roles::text as roles
  from pg_policies
  where schemaname='public'
    and tablename in ('contract_history','employee_status_history')
  order by tablename, cmd
`);
console.table(pol.rows);

console.log("=== Hak authenticated via has_table_privilege ===");
const priv = await client.query(`
  select t as tabel,
         has_table_privilege('authenticated', 'public.'||t, 'INSERT') as can_insert,
         has_table_privilege('authenticated', 'public.'||t, 'SELECT') as can_select,
         has_table_privilege('anon', 'public.'||t, 'INSERT') as anon_insert
  from (values ('contract_history'), ('employee_status_history')) v(t)
`);
console.table(priv.rows);

console.log("=== Baseline data ===");
const counts = await client.query(`
  select 'employees' t, count(*)::int c from public.employees
  union all select 'contracts', count(*)::int from public.contracts
  union all select 'contract_history', count(*)::int from public.contract_history
  union all select 'employee_status_history', count(*)::int from public.employee_status_history
`);
console.table(counts.rows);

await client.end();
