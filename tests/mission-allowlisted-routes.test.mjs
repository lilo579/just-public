import test from "node:test"
import assert from "node:assert/strict"
import { resolveAllowlistedMissionRoute } from "../src/lib/resolveAllowlistedMissionRoute.js"
import { missionRoutesFromPayload } from "../src/lib/missionRoutesFromPayload.js"
import { SYNTHETIC_F4_HOST } from "../src/poc/syntheticF4MissionTenant.js"

test("synthetic F4 allowlists privacy and participate", () => {
  const privacy = resolveAllowlistedMissionRoute(SYNTHETIC_F4_HOST, "/privacy", "content_page")
  const form = resolveAllowlistedMissionRoute(SYNTHETIC_F4_HOST, "/participate", "form_signup_shell")
  assert.ok(privacy)
  assert.ok(form)
  assert.equal(privacy.route.path, "/privacy")
  assert.equal(form.route.kind, "form_signup_shell")
})

test("payload-declared Dorot-shaped paths resolve without host branching", () => {
  const routes = [
    { kind: "content_page", path: "/privacidade", title: "Privacidade" },
    { kind: "content_page", path: "/termos-do-clube", title: "Clube" },
    { kind: "form_signup_shell", path: "/clube/assinar", title: "Assinar" },
  ]
  const host = "www.canonical-mission.example.test"
  assert.ok(resolveAllowlistedMissionRoute(host, "/privacidade", "content_page", routes))
  assert.ok(resolveAllowlistedMissionRoute(host, "/termos-do-clube", "content_page", routes))
  assert.ok(resolveAllowlistedMissionRoute(host, "/clube/assinar", "form_signup_shell", routes))
  assert.equal(
    resolveAllowlistedMissionRoute(host, "/unknown", "content_page", routes),
    null,
  )
})

test("missionRoutesFromPayload reads payload.routes and source.mission.routes", () => {
  assert.deepEqual(
    missionRoutesFromPayload({ routes: [{ kind: "content_page", path: "/a" }] }).map((r) => r.path),
    ["/a"],
  )
  assert.deepEqual(
    missionRoutesFromPayload({
      source: { mission: { routes: [{ kind: "content_page", path: "/b" }] } },
    }).map((r) => r.path),
    ["/b"],
  )
})

test("unknown route kinds are rejected by allowlist matcher", () => {
  const routes = [{ kind: "arbitrary_handler", path: "/hack", title: "x" }]
  assert.equal(
    resolveAllowlistedMissionRoute("example.test", "/hack", "content_page", routes),
    null,
  )
})
