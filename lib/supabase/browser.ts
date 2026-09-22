"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Cookie-backed browser client used for auth and per-user tables (saves,
 * profiles). Cookies let the Next.js middleware and server code see the same
 * session. The legacy `./client` singleton remains for public seed reads.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
