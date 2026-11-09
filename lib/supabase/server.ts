/**
 * Client Supabase untuk server.
 *
 * - `getServerSupabase()` → memakai session/JWT pengguna (cookie), sehingga
 *   RLS berlaku. Dipakai seluruh repository data aplikasi.
 * - `getServiceSupabase()` → service role, HANYA untuk pekerjaan administratif
 *   (manajemen akun). Jangan pernah dipakai untuk operasi biasa pengguna.
 *
 * Jangan import file ini dari komponen client.
 */

import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Kredensial Supabase publik belum diatur. Salin .env.example ke .env.local."
    );
  }

  return { url, anonKey };
}

/** Client terikat session pengguna — RLS berlaku. Satu client per request. */
export const getServerSupabase = cache(
  async (): Promise<SupabaseClient> => {
    const { url, anonKey } = publicEnv();
    const cookieStore = await cookies();

    return createServerClient(url, anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component tidak boleh menulis cookie; proxy yang me-refresh.
          }
        },
      },
    });
  }
);

let serviceClient: SupabaseClient | null = null;

/** Service role — hanya untuk administrasi akun di server. */
export function getServiceSupabase(): SupabaseClient {
  if (serviceClient) return serviceClient;

  const { url } = publicEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diatur di environment server."
    );
  }

  serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return serviceClient;
}
