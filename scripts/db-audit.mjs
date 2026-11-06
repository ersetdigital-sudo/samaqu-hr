#!/usr/bin/env node
/**
 * Audit READ-ONLY katalog database HRIS Samaqu.
 * Hanya SELECT pada katalog (pg_class, pg_proc, pg_policy, ...).
 *
 * Pakai: node scripts/db-audit.mjs
 */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pick = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();

const dbPassword = process.env.SAMAQU_DB_PASSWORD ?? pick("SAMAQU_DB_PASSWORD") ?? "";
const conn =
  process.env.DATABASE_URL ??
  `postgresql://postgres.wyfeotgzfewccmnsbcbf:${encodeURIComponent(
    dbPassword
  )}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`;

const client = new pg.Client({
  connectionString: conn,
  connectionTimeoutMillis: 15000,
  ssl: { rejectUnauthorized: false },
});

const section = (title) => console.log(`\n=== ${title} ===`);

await client.connect();

section("Hak tabel (information_schema.role_table_grants)");
const grants = await client.query(`
  select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('contract_history','employee_status_history')
  group by table_name, grantee
  order by table_name, grantee
`);
console.table(grants.rows);

section("ACL mentah (pg_class.relacl)");
const acl = await client.query(`
  select c.relname,
         coalesce(c.relacl::text, '(default: owner only)') as relacl
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('contract_history','employee_status_history')
`);
acl.rows.forEach((r) => console.log(`${r.relname}: ${r.relacl}`));

section("RLS policy");
const policies = await client.query(`
  select tablename, policyname, cmd, roles::text, qual, with_check
  from pg_policies
  where schemaname = 'public'
    and tablename in ('contract_history','employee_status_history')
  order by tablename, policyname
`);
policies.rows.forEach((r) =>
  console.log(
    `${r.tablename} | ${r.policyname} | ${r.cmd} | roles=${r.roles}\n  using: ${r.qual ?? "-"}\n  check: ${r.with_check ?? "-"}`
  )
);

section("Trigger histori");
const triggers = await client.query(`
  select t.tgname, c.relname as tbl, p.proname as fn
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where n.nspname = 'public' and not t.tgisinternal
  order by c.relname, t.tgname
`);
console.table(triggers.rows);

section("Fungsi trigger: security + search_path + ACL");
const funcs = await client.query(`
  select p.proname,
         case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security,
         coalesce(array_to_string(p.proconfig, ' | '), '(search_path TIDAK diset)') as config,
         coalesce(array_to_string(p.proacl, ' | '), '(default PUBLIC execute)') as acl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('log_contract_change','log_employee_status_change')
`);
funcs.rows.forEach((r) =>
  console.log(`${r.proname}: ${r.security} | ${r.config}\n  acl: ${r.acl}`)
);

section("Baseline data");
const counts = await client.query(`
  select 'employees' t, count(*) from public.employees
  union all select 'contracts', count(*) from public.contracts
  union all select 'contract_history', count(*) from public.contract_history
  union all select 'employee_status_history', count(*) from public.employee_status_history
`);
console.table(counts.rows);

const owners = await client.query(`
  select c.relname, pg_get_userbyid(c.relowner) as owner
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('contract_history','employee_status_history')
`);
console.table(owners.rows);

await client.end();
