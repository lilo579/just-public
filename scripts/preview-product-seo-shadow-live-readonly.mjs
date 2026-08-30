#!/usr/bin/env node
/**
 * Live read-only shadow of 3D Jewish via public RPCs.
 * Anon key only. Zero writes. Evidence goes to a private directory, never Git.
 *
 *   SUPABASE_ANON_KEY=... PUBLIC_SUPABASE_URL=https://....supabase.co \
 *     node scripts/preview-product-seo-shadow-live-readonly.mjs
 */
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { identityKey, displayText } from "../src/lib/productSeoCompilerV1.js"
import {
  createHostBoundCatalogLoader,
  loadProductSeoCanonicalContextV1,
  liveCatalogLoaderGate,
  runProductSeoShadowV1,
  wrapReadOnlySupabase,
  READ_ONLY_CATALOG_RPC,
  READ_ONLY_CANONICAL_RPC,
  READ_ONLY_RPC_ALLOWLIST,
} from "../src/lib/productSeoShadowRunnerV1.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const HOST = "3djewish.com.br"
const WWW_HOST = "www.3djewish.com.br"
const EXPECTED_TENANT = "76a96afa-80f9-4782-a08d-e869e79d7d84"
const FIXTURE_PATH = join(root, "tests/fixtures/product-seo-compiler/jewish-118.json")
const EVIDENCE_DIR = process.env.SHADOW_LIVE_EVIDENCE_DIR || "/tmp/just-seo-shadow-live"
const PUBLIC_URL =
  (process.env.PUBLIC_SUPABASE_URL || "https://ehondnpqztvybvgsjnxe.supabase.co").replace(/\/$/, "")

function abort(reason) {
  process.stderr.write(`${JSON.stringify({ ok: false, reason }, null, 2)}\n`)
  process.exit(3)
}

function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))
    return typeof payload.role === "string" ? payload.role : ""
  } catch {
    return ""
  }
}

function loadAnonKey() {
  const fromEnv = (process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || "").trim()
  if (fromEnv) return fromEnv
  for (const name of [".dev.vars", ".env"]) {
    const path = join(root, name)
    try {
      const text = readFileSync(path, "utf8")
      const match = text.match(/^(?:PUBLIC_)?SUPABASE_ANON_KEY=(.+)$/m)
      if (match) return match[1].trim().replace(/^["']|["']$/g, "")
    } catch {
      /* absent */
    }
  }
  return ""
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function rowId(row) {
  return identityKey(row?.productId ?? row?.product_id)
}

function catalogFingerprint(rows) {
  const lines = rows
    .map((row) =>
      [
        rowId(row),
        displayText(row?.slug),
        identityKey(row?.name ?? row?.title),
        identityKey(row?.lineName ?? row?.line_name),
        String(Number(row?.price)),
      ].join("|"),
    )
    .sort()
  return sha256(lines.join("\n"))
}

const anonKey = loadAnonKey()
if (!anonKey) abort("missing_anon_key")
if (/service_role|SERVICE_ROLE/.test(anonKey)) abort("privileged_credential")
const role = jwtRole(anonKey)
if (role && role !== "anon") abort(`privileged_role:${role}`)
if (process.env.SUPABASE_SERVICE_ROLE_KEY) abort("service_role_env_present")

const writeAttempts = []
const rawClient = createClient(PUBLIC_URL, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const supabase = wrapReadOnlySupabase(
  {
    rpc(name, args) {
      if (!READ_ONLY_RPC_ALLOWLIST.includes(name)) abort(`non_catalog_rpc:${name}`)
      return rawClient.rpc(name, args)
    },
  },
  writeAttempts,
)

const capturedAt = new Date().toISOString()
const apexAuthority = await loadProductSeoCanonicalContextV1({
  supabase,
  requestHost: HOST,
  expectedTenantId: EXPECTED_TENANT,
  writeAttempts,
})
const wwwAuthority = await loadProductSeoCanonicalContextV1({
  supabase,
  requestHost: WWW_HOST,
  expectedTenantId: EXPECTED_TENANT,
  writeAttempts,
})

if (!apexAuthority.ok || !apexAuthority.trustedForShadow) {
  abort(apexAuthority.reason || "canonical_untrusted")
}

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"))
const loader = createHostBoundCatalogLoader({
  host: HOST,
  supabase,
  writeAttempts,
})
const gate = liveCatalogLoaderGate(loader)
if (!gate.ok) abort(gate.reason)
const livePage = await loader({ page: 1, pageSize: 500, signal: AbortSignal.timeout(4000) })
if (writeAttempts.length) abort("write_attempted")
const liveRows = Array.isArray(livePage.rows) ? livePage.rows : []

const report = await runProductSeoShadowV1({
  context: {
    expectedTenantId: EXPECTED_TENANT,
    host: HOST,
    brand: fixture.tenantBrand || "3D Jewish",
    catalogEnabled: true,
    tenantActive: true,
    canonicalContext: apexAuthority,
  },
  loadCatalog: loader,
})
if (report.readOnlyExecution !== "verified") abort("unverified_loader")
if (report.writesObserved == null) abort("unverified_loader")

mkdirSync(EVIDENCE_DIR, { recursive: true })
writeFileSync(join(EVIDENCE_DIR, "live-catalog.json"), `${JSON.stringify(liveRows, null, 2)}\n`)
writeFileSync(join(EVIDENCE_DIR, "live-shadow-report.json"), `${JSON.stringify(report, null, 2)}\n`)

const fixtureIds = new Set(fixture.products.map(rowId))
const liveIds = new Set(liveRows.map(rowId))

const summary = {
  ok: true,
  mode: "shadow-report-only",
  readOnlyExecution: report.readOnlyExecution,
  loaderKind: report.loaderKind,
  writes: report.writes,
  writesObserved: report.writesObserved,
  writeAttempts,
  allowlist: READ_ONLY_RPC_ALLOWLIST,
  rpc: [READ_ONLY_CANONICAL_RPC, READ_ONLY_CATALOG_RPC],
  host: HOST,
  capturedAtUtc: capturedAt,
  canonical: {
    apex: {
      ok: apexAuthority.ok,
      relation: apexAuthority.relation,
      primaryHost: apexAuthority.primaryHost,
      tenantId: apexAuthority.tenantId,
      trustedForShadow: apexAuthority.trustedForShadow,
    },
    www: {
      ok: wwwAuthority.ok,
      reason: wwwAuthority.reason,
      relation: wwwAuthority.relation,
      primaryHost: wwwAuthority.primaryHost,
      tenantId: wwwAuthority.tenantId,
      trustedForShadow: wwwAuthority.trustedForShadow,
    },
  },
  fixtureCount: fixture.products.length,
  liveCount: liveRows.length,
  fixtureFingerprint: catalogFingerprint(fixture.products),
  liveFingerprint: catalogFingerprint(liveRows),
  idsOnlyInFixture: [...fixtureIds].filter((id) => !liveIds.has(id)).length,
  idsOnlyInLive: [...liveIds].filter((id) => !fixtureIds.has(id)).length,
  completeness: {
    catalogComplete: report.catalogComplete,
    completeness: report.completeness,
    completenessReason: report.completenessReason,
    usableForEnforcement: report.usableForEnforcement,
    note: "public_get_products_by_host does not return totalCount/snapshotVersion; completeness is unknown.",
  },
  liveCompiled: {
    total: report.metrics?.total,
    auto_ready: report.metrics?.auto_ready,
    needs_input: report.metrics?.needs_input,
    override_ready: report.metrics?.override_ready,
    qualityWarnings: report.metrics?.qualityWarnings,
  },
  evidenceDir: EVIDENCE_DIR,
}

writeFileSync(join(EVIDENCE_DIR, "anonymized-summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
