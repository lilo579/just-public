import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { resolveAllowlistedMissionRoute } from "../src/lib/resolveAllowlistedMissionRoute.js"
import { missionRoutesFromPayload } from "../src/lib/missionRoutesFromPayload.js"
import { STATIC_PUBLIC_PATHS } from "../src/lib/publicRouteKind.js"
import { SYNTHETIC_F4_HOST } from "../src/poc/syntheticF4MissionTenant.js"

const DOROT_SHAPED_ROUTES = [
  {
    kind: "content_page",
    path: "/privacidade",
    title: "Aviso de Privacidade",
    heading: "Aviso de Privacidade",
    body: "Privacy body",
  },
  {
    kind: "content_page",
    path: "/termos-do-clube",
    title: "Informações do Clube Dorot",
    heading: "Informações do Clube Dorot",
    body: "Club terms body",
  },
  {
    kind: "form_signup_shell",
    path: "/clube/assinar",
    title: "Assinar o Clube Dorot",
    heading: "Faça parte do Clube Dorot",
    body: "Signup body",
  },
]

const FIXTURE_HOST = "mission-fixture.example.test"

test("allowlisted Dorot-shaped routes resolve from payload routes (no host branch)", () => {
  const privacy = resolveAllowlistedMissionRoute(
    FIXTURE_HOST,
    "/privacidade",
    "content_page",
    DOROT_SHAPED_ROUTES,
  )
  assert.ok(privacy)
  assert.equal(privacy.route.path, "/privacidade")

  const terms = resolveAllowlistedMissionRoute(
    FIXTURE_HOST,
    "/termos-do-clube",
    "content_page",
    DOROT_SHAPED_ROUTES,
  )
  assert.ok(terms)
  assert.equal(terms.route.kind, "content_page")

  const form = resolveAllowlistedMissionRoute(
    FIXTURE_HOST,
    "/clube/assinar",
    "form_signup_shell",
    DOROT_SHAPED_ROUTES,
  )
  assert.ok(form)
  assert.equal(form.route.kind, "form_signup_shell")

  assert.equal(
    resolveAllowlistedMissionRoute(FIXTURE_HOST, "/secret", "content_page", DOROT_SHAPED_ROUTES),
    null,
  )
})

test("missionRoutesFromPayload prefers payload.routes then mission.routes", () => {
  assert.deepEqual(
    missionRoutesFromPayload({ routes: DOROT_SHAPED_ROUTES }).map((r) => r.path),
    ["/privacidade", "/termos-do-clube", "/clube/assinar"],
  )
  assert.deepEqual(
    missionRoutesFromPayload({
      source: { mission: { routes: DOROT_SHAPED_ROUTES } },
    }).map((r) => r.path),
    ["/privacidade", "/termos-do-clube", "/clube/assinar"],
  )
})

test("STATIC_PUBLIC_PATHS includes club legal and signup paths", () => {
  assert.ok(STATIC_PUBLIC_PATHS.includes("/termos-do-clube"))
  assert.ok(STATIC_PUBLIC_PATHS.includes("/clube/assinar"))
})

test("synthetic F4 allowlist path still works without payload routes arg", () => {
  const privacy = resolveAllowlistedMissionRoute(SYNTHETIC_F4_HOST, "/privacy", "content_page")
  assert.ok(privacy)
  assert.equal(privacy.route.path, "/privacy")
})

test("architecture guard: no dorotpublications hardcode in src production paths", () => {
  const root = join(process.cwd(), "src")
  /** @type {string[]} */
  const hits = []

  /**
   * @param {string} dir
   */
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        if (name === "node_modules" || name === "poc") continue
        walk(full)
        continue
      }
      if (!/\.(js|ts|astro|mjs|cjs)$/.test(name)) continue
      const text = readFileSync(full, "utf8")
      if (/dorotpublications/i.test(text)) hits.push(full.replace(process.cwd() + "/", ""))
    }
  }

  walk(root)
  assert.deepEqual(hits, [], `unexpected dorotpublications hardcodes: ${hits.join(", ")}`)
})
