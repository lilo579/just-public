/**
 * Server-side Supabase client for Worker catalog routes.
 * Prefer runtime bindings; derive project URL from PUBLIC_SITE_PAYLOAD_URL when needed.
 * Never import from client components.
 */
import { createClient } from "@supabase/supabase-js";
import {
  getServerRuntimeString,
  resolveSitePayloadUrl,
  resolveSupabaseAnonKey,
} from "./runtimeEnv.js";

/**
 * @param {{ runtime?: { env?: Record<string, unknown> } } | undefined} [locals]
 * @returns {string | undefined}
 */
export function resolveSupabaseUrl(locals) {
  const explicit = getServerRuntimeString(locals, "PUBLIC_SUPABASE_URL");
  if (explicit) return explicit.replace(/\/$/, "");

  const payloadUrl = resolveSitePayloadUrl(locals);
  if (!payloadUrl) return undefined;
  try {
    return new URL(payloadUrl).origin;
  } catch {
    return undefined;
  }
}

/**
 * @param {{ runtime?: { env?: Record<string, unknown> } } | undefined} [locals]
 * @returns {import("@supabase/supabase-js").SupabaseClient | null}
 */
export function createPublicSupabaseClient(locals) {
  const url = resolveSupabaseUrl(locals);
  const anonKey = resolveSupabaseAnonKey(locals);
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
