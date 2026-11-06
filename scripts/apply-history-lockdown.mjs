#!/usr/bin/env node
/**
 * Terapkan migration 20261104090000_history_insert_lockdown.sql ke database.
 *
 * Dijalankan sebagai satu transaksi: bila isi migration gagal, seluruhnya
 * di-rollback dan proses berhenti. Tidak ada perubahan di luar file migration.
 *
 * Pakai: node scripts/apply-history-lockdown.mjs
 */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pick = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();
const dbPassword = process.env.SAMAQU_DB_PASSWORD ?? pick("SAMAQU_DB_PASSWORD") ?? "";

const MIGRATION = new URL(
  "../supabase/migrations/20261104090000_history_insert_lockdown.sql",
  import.meta.url
);

const client = new pg.Client({
  connectionString: `postgresql://postgres.wyfeotgzfewccmnsbcbf:${encodeURIComponent(
    dbPassword
  )}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  connectionTimeoutMillis: 15000,
  ssl: { rejectUnauthorized: false },
});

const sql = readFileSync(MIGRATION, "utf8");

await client.connect();
console.log("Terhubung. Menjalankan migration sebagai transaksi tunggal...\n");

try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("MIGRATION OK — committed.");
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error("MIGRATION GAGAL — di-rollback. Tidak ada perubahan.");
  console.error(error.message);
  await client.end();
  process.exit(1);
}

await client.end();
