import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  getServerRuntimeString,
  isLeadIntakeSafeMode,
  resolveDeployEnv,
  resolveSitePayloadUrl,
  resolveSupabaseAnonKey,
} from "../src/lib/runtimeEnv.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("getServerRuntimeString prefers Worker locals.runtime.env over process.env", () => {
  const prev = process.env.DEPLOY_ENV
  process.env.DEPLOY_ENV = "from-process"
  try {
    const locals = { runtime: { env: { DEPLOY_ENV: "from-worker" } } }
    assert.equal(getServerRuntimeString(locals, "DEPLOY_ENV"), "from-worker")
  } finally {
    if (prev === undefined) delete process.env.DEPLOY_ENV
    else process.env.DEPLOY_ENV = prev
  }
})

test("getServerRuntimeString distinguishes absent from empty string", () => {
  const locals = { runtime: { env: { DEPLOY_ENV: "" } } }
  assert.equal(getServerRuntimeString(locals, "DEPLOY_ENV"), "")
  assert.equal(getServerRuntimeString(locals, "MISSING_KEY"), undefined)
})

test("resolveDeployEnv uses DEPLOY_ENV then PUBLIC_DEPLOY_ENV contingency", () => {
  assert.equal(
    resolveDeployEnv({ runtime: { env: { DEPLOY_ENV: "staging", PUBLIC_DEPLOY_ENV: "ignored" } } }),
    "staging",
  )
  assert.equal(
    resolveDeployEnv({ runtime: { env: { PUBLIC_DEPLOY_ENV: "staging" } } }),
    "staging",
  )
  assert.equal(resolveDeployEnv({ runtime: { env: {} } }), undefined)
})

test("resolveSitePayloadUrl / anon key have no production defaults", () => {
  assert.equal(resolveSitePayloadUrl({ runtime: { env: {} } }), undefined)
  assert.equal(resolveSupabaseAnonKey({ runtime: { env: {} } }), undefined)
  assert.equal(
    resolveSitePayloadUrl({
      runtime: { env: { PUBLIC_SITE_PAYLOAD_URL: "http://127.0.0.1:9/mock" } },
    }),
    "http://127.0.0.1:9/mock",
  )
})

test("isLeadIntakeSafeMode: preview/staging only (case-insensitive)", () => {
  assert.equal(isLeadIntakeSafeMode("preview"), true)
  assert.equal(isLeadIntakeSafeMode("PREVIEW"), true)
  assert.equal(isLeadIntakeSafeMode("staging"), true)
  assert.equal(isLeadIntakeSafeMode(" Staging "), true)
  assert.equal(isLeadIntakeSafeMode("production"), false)
  assert.equal(isLeadIntakeSafeMode("prod"), false)
  assert.equal(isLeadIntakeSafeMode(""), false)
  assert.equal(isLeadIntakeSafeMode(undefined), false)
})

test("wrangler.jsonc has no nodejs_compat and no SESSION KV binding", async () => {
  const text = await fs.readFile(path.join(root, "wrangler.jsonc"), "utf8")
  assert.doesNotMatch(text, /nodejs_compat/)
  assert.doesNotMatch(text, /kv_namespaces|SESSION/)
})

test(".dev.vars is gitignored and must not be committed if present", async () => {
  const gitignore = await fs.readFile(path.join(root, ".gitignore"), "utf8")
  assert.match(gitignore, /^\.dev\.vars$/m)
  const { execFileSync } = await import("node:child_process")
  let tracked
  try {
    tracked = execFileSync("git", ["ls-files", ".dev.vars"], {
      cwd: root,
      encoding: "utf8",
    }).trim()
  } catch {
    tracked = ""
  }
  assert.equal(tracked, "", ".dev.vars must not be tracked by git")
})
