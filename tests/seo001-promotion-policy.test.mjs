import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  assertAuthorityMode,
  assertPromotionConfirm,
  assertVersionId,
  loadApprovedTenantsFromFile,
  parseApprovedTenants,
  resolveAllowlistedTenant,
  resolveCheckerHosts,
} from "../scripts/ops/seo001-promotion-policy.mjs"
import { runPostDeployVerification, runPreFlipPostDeployChecks } from "../scripts/ci/seo001-post-deploy-verify.mjs"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

test("allowlist hosts match inventory and all disabled", async () => {
  const file = await fs.readFile(path.join(root, "ops/seo001/approved-tenants.json"), "utf8")
  const tenants = parseApprovedTenants(JSON.parse(file))
  assert.equal(tenants.just.primary, "justwebsites.com.br")
  assert.equal(tenants["3d-jewish"].alias, "www.3djewish.com.br")
  for (const entry of Object.values(tenants)) {
    assert.equal(entry.enabled, false)
  }
})

test("reject unknown and disabled tenants", () => {
  const allowlist = parseApprovedTenants({
    just: { primary: "justwebsites.com.br", alias: "www.justwebsites.com.br", enabled: false },
  })
  assert.throws(() => resolveAllowlistedTenant(allowlist, "unknown"), /not in the allowlist/)
  assert.throws(() => resolveAllowlistedTenant(allowlist, "just"), /disabled/)
})

test("confirmation token is derived from slug only", () => {
  assert.doesNotThrow(() => assertPromotionConfirm("flavio-personal", "PROMOTE_FLAVIO_PERSONAL"))
  assert.throws(() => assertPromotionConfirm("flavio-personal", "PROMOTE_flavio-personal"))
})

test("checker hosts come from allowlist not operator strings", () => {
  const tenant = {
    primary: "rossanamendonca.com.br",
    alias: "www.rossanamendonca.com.br",
    enabled: true,
  }
  const post = resolveCheckerHosts(tenant, "post_flip")
  assert.equal(post.primaryHost, "rossanamendonca.com.br")
  const pre = resolveCheckerHosts(tenant, "pre_flip")
  assert.equal(pre.primaryHost, tenant.primary)
  assert.equal(pre.wwwAliasHost, tenant.alias)
})

test("version id must be UUID", () => {
  assert.equal(assertVersionId("7a039076-11cc-4db2-abf0-b9a4d0ae4b58"), "7a039076-11cc-4db2-abf0-b9a4d0ae4b58")
  assert.throws(() => assertVersionId("not-a-uuid"))
})

test("authority mode restricted", () => {
  assert.equal(assertAuthorityMode("pre_flip"), "pre_flip")
  assert.throws(() => assertAuthorityMode("apex"))
})

test("pre_flip post-deploy checks use mocked fetch", async () => {
  const www = "www.example.com.br"
  const apex = "example.com.br"
  const html = `<link rel="canonical" href="https://${www}/" />`
  const fetchImpl = async (url, init) => {
    const u = String(url)
    if (u === `https://${www}/`) return new Response(html, { status: 200 })
    if (u === `https://${apex}/`) {
      return new Response("", { status: 301, headers: { location: `https://${www}/` } })
    }
    if (u === `http://${apex}/sobre`) {
      return new Response("", { status: 301, headers: { location: `https://${www}/sobre` } })
    }
    if (u === `http://${www}/sobre`) {
      return new Response("", { status: 301, headers: { location: `https://${www}/sobre` } })
    }
    if (u.includes("__seo001_missing_")) return new Response("", { status: 404 })
    return new Response("missing", { status: 500 })
  }
  const report = await runPreFlipPostDeployChecks({
    apexHost: apex,
    wwwHost: www,
    fetchImpl,
  })
  assert.equal(report.ok, true)
})

test("loadApprovedTenantsFromFile reads repo allowlist", () => {
  const tenants = loadApprovedTenantsFromFile(path.join(root, "ops/seo001/approved-tenants.json"))
  assert.ok(tenants["celina-pires"])
})

test("post_flip delegates to external checker via mock path", async () => {
  process.env.SEO001_NEXUS_ROOT = path.join(root, "tests/fixtures/seo001-mock-nexus")
  const report = await runPostDeployVerification({
    primaryHost: "example.com.br",
    wwwAliasHost: "www.example.com.br",
    mode: "post_flip",
    fetchImpl: async () => new Response("", { status: 200 }),
  })
  assert.equal(report.ok, true)
})
