"use client";

/** Client Supabase untuk browser: menyimpan session pada cookie via @supabase/ssr. */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function createBrowserSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Konfigurasi Supabase publik belum tersedia.");
  }

  cached = createBrowserClient(url, anonKey);
  return cached;
}
