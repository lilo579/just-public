import assert from "node:assert/strict"
import test from "node:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { chooseHomepageRenderer } from "../src/lib/publicHomepageHelpers.js"
import { FIXTURE_ALPHA } from "./fixtures/poc-canonical-payloads.mjs"
import {
  FIXTURE_SYNTHETIC_F4,
  listSyntheticF4PaintComponents,
} from "../src/poc/syntheticF4MissionTenant.js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(ROOT, "src")

const FORBIDDEN = [/dorotpublications/i]

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === ".astro") continue
      walk(full, files)
    } else if (/\.(js|mjs|ts|astro)$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

test("no production path selects by dorotpublications", () => {
  const offenders = []
  for (const file of walk(SRC)) {
    const content = readFileSync(file, "utf8")
    for (const pattern of FORBIDDEN) {
      if (pattern.test(content)) {
        offenders.push(file.replace(ROOT + "/", ""))
        break
      }
    }
  }
  assert.deepEqual(offenders, [])
})

test("F4 synthetic e2e unit: fixture plan contains F4 paint components", () => {
  const components = listSyntheticF4PaintComponents()
  assert.ok(components.includes("initiative"))
  assert.ok(components.includes("progress_track"))
  assert.ok(components.includes("patronage"))
  assert.ok(components.includes("recurring_support"))
  assert.ok(components.includes("history_collection"))
})

test("static F4 works without publications", () => {
  assert.equal(chooseHomepageRenderer(FIXTURE_SYNTHETIC_F4).mode, "canonical")
  assert.equal("publications" in FIXTURE_SYNTHETIC_F4, false)
})

test("F1 plans still choose canonical renderer", () => {
  assert.equal(chooseHomepageRenderer(FIXTURE_ALPHA).mode, "canonical")
})
