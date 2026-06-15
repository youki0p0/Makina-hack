// ===== Supabase client (optional) =====
// Connection info comes ONLY from environment variables (never hardcoded):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
// If either is missing, getSupabaseClient() returns null and the app falls back
// to the local repository — the app must never crash when Supabase is absent.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when both env vars are present (Supabase is configured). */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

/** Lazily create the Supabase client, or null if not configured / on error. */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;
  try {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: false },
    });
    return client;
  } catch {
    // Misconfigured env should never take the app down.
    return null;
  }
}
