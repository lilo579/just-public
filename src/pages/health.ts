import type { APIRoute } from "astro"

export const prerender = false

/**
 * Liveness only — no Supabase, Edge, tenant, or Host dependency.
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ status: "ok", service: "just-public" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
