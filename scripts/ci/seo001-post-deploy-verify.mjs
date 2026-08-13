#!/usr/bin/env node
/**
 * Post-deploy HTTP verification for SEO-001 promotions.
 * Delegates apex-final checks to the Nexus external readiness checker when available.
 */

import { pathToFileURL } from "node:url"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import {
  assertAuthorityMode,
  resolveCheckerHosts,
} from "../ops/seo001-promotion-policy.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const publicRoot = path.join(here, "../..")

/**
 * @param {string} [nexusRoot]
 */
export function resolveNexusCheckerModule(nexusRoot = process.env.SEO001_NEXUS_ROOT) {
  const root =
    nexusRoot ||
    path.join(publicRoot, "../just-auth-nexus") ||
    path.join(publicRoot, "just-auth-nexus")
  return pathToFileURL(
    path.join(root, "scripts/ops/seo001-external-readiness-checker.mjs"),
  ).href
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 */
async function fetchHops(fetchImpl, url) {
  let current = url
  let res = /** @type {Response} */ (null)
  const chain = []
  for (let i = 0; i < 5; i++) {
    res = await fetchImpl(current, { method: "GET", redirect: "manual" })
    chain.push(`${res.status}:${current}`)
    if (![301, 302, 307, 308].includes(res.status)) break
    const loc = res.headers.get("location")
    if (!loc) break
    current = new URL(loc, current).toString()
  }
  return { res, finalUrl: current, hops: chain.length - 1, chain }
}

/**
 * Legacy www-primary matrix (pre_flip) — Worker may ship before DB flip.
 *
 * @param {{
 *   apexHost: string
 *   wwwHost: string
 *   fetchImpl?: typeof fetch
 *   samplePath?: string
 * }} input
 */
export async function runPreFlipPostDeployChecks(input) {
  const fetchImpl = input.fetchImpl || globalThis.fetch
  const apex = input.apexHost
  const www = input.wwwHost
  const samplePath = input.samplePath || "/sobre"
  const wwwOrigin = `https://${www}`
  /** @type {{ id: string, ok: boolean, detail?: string }[]} */
  const checks = []
  const push = (id, ok, detail) => checks.push({ id, ok: Boolean(ok), detail })

  try {
    const code = (await fetchImpl(`${wwwOrigin}/`, { redirect: "follow" })).status
    push("https_www_responds", code >= 200 && code < 400, `status=${code}`)
  } catch (err) {
    push("https_www_responds", false, String(err))
  }

  try {
    const apexHeaders = await fetchImpl(`https://${apex}/`, { redirect: "manual" })
    const loc = apexHeaders.headers.get("location") || ""
    push(
      "https_apex_to_www",
      apexHeaders.status === 301 && loc.startsWith(`${wwwOrigin}/`),
      `${apexHeaders.status} ${loc}`,
    )
  } catch (err) {
    push("https_apex_to_www", false, String(err))
  }

  for (const row of [
    { id: "http_apex_one_hop_to_www", url: `http://${apex}${samplePath}` },
    { id: "http_www_one_hop", url: `http://${www}${samplePath}` },
  ]) {
    try {
      const hops = await fetchHops(fetchImpl, row.url)
      const ok =
        hops.hops === 1 &&
        hops.finalUrl.startsWith(`${wwwOrigin}${samplePath === "/" ? "/" : samplePath}`)
      push(row.id, ok, hops.chain.join(" → "))
    } catch (err) {
      push(row.id, false, String(err))
    }
  }

  try {
    const html = await (await fetchImpl(`${wwwOrigin}/`, { redirect: "follow" })).text()
    const canonical =
      html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ||
      html.match(/href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1] ||
      ""
    push("canonical_www", canonical === `${wwwOrigin}/`, `canonical=${canonical}`)
  } catch (err) {
    push("canonical_www", false, String(err))
  }

  try {
    const r = await fetchImpl(`${wwwOrigin}/__seo001_missing_${Date.now()}`, {
      redirect: "follow",
    })
    push("real_404", r.status === 404, `status=${r.status}`)
  } catch (err) {
    push("real_404", false, String(err))
  }

  const failed = checks.filter((c) => !c.ok)
  return { ok: failed.length === 0, mode: "pre_flip", checks, failed }
}

/**
 * @param {{
 *   primaryHost: string
 *   wwwAliasHost: string
 *   mode: "pre_flip" | "post_flip"
 *   fetchImpl?: typeof fetch
 *   samplePath?: string
 * }} input
 */
export async function runPostDeployVerification(input) {
  const mode = assertAuthorityMode(input.mode)
  if (mode === "pre_flip") {
    return runPreFlipPostDeployChecks({
      apexHost: input.primaryHost,
      wwwHost: input.wwwAliasHost,
      fetchImpl: input.fetchImpl,
      samplePath: input.samplePath,
    })
  }

  const mod = await import(resolveNexusCheckerModule())
  return mod.runExternalReadinessChecks({
    primaryHost: input.primaryHost,
    wwwAliasHost: input.wwwAliasHost,
    fetchImpl: input.fetchImpl,
    samplePath: input.samplePath,
  })
}

function runningAsCli() {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(entry).href
}

if (runningAsCli()) {
  const { values } = parseArgs({
    options: {
      primary: { type: "string" },
      www: { type: "string" },
      mode: { type: "string", default: "post_flip" },
      json: { type: "boolean", default: false },
    },
  })
  if (!values.primary || !values.www) {
    console.error("Usage: --primary <host> --www <alias> [--mode pre_flip|post_flip] [--json]")
    process.exit(2)
  }
  const report = await runPostDeployVerification({
    primaryHost: values.primary,
    wwwAliasHost: values.www,
    mode: /** @type {"pre_flip"|"post_flip"} */ (values.mode),
  })
  if (values.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`SEO-001 post-deploy verify (${report.mode ?? values.mode}): ${report.ok ? "PASS" : "FAIL"}`)
    for (const c of report.checks) {
      console.log(`${c.ok ? "OK  " : "FAIL"} ${c.id}${c.detail ? ` — ${c.detail}` : ""}`)
    }
  }
  process.exit(report.ok ? 0 : 1)
}
