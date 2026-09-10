/**
 * Allowlisted multi-route foundation for F4 synthetic (and future mission) tenants.
 * No arbitrary handlers — only explicit route kinds + fixture-declared paths.
 */

import {
  FIXTURE_SYNTHETIC_F4,
  SYNTHETIC_F4_HOST,
} from "../poc/syntheticF4MissionTenant.js"
import { resolvePocFixturePayload } from "../poc/publicSiteFixtures.js"

/**
 * @param {string} host
 * @param {string} path
 * @param {"content_page"|"form_signup_shell"} kind
 */
export function resolveAllowlistedMissionRoute(host, path, kind) {
  const normalizedHost = typeof host === "string" ? host.trim().toLowerCase() : ""
  const normalizedPath = typeof path === "string" ? path.split("?")[0].split("#")[0] : ""
  if (!normalizedHost || !normalizedPath.startsWith("/")) return null

  const fixture =
    normalizedHost === SYNTHETIC_F4_HOST
      ? FIXTURE_SYNTHETIC_F4
      : resolvePocFixturePayload(normalizedHost)

  const routes = Array.isArray(fixture?.routes)
    ? fixture.routes
    : Array.isArray(fixture?.source?.missionRoutes)
      ? fixture.source.missionRoutes
      : []

  const match = routes.find(
    (route) =>
      route &&
      route.kind === kind &&
      typeof route.path === "string" &&
      route.path === normalizedPath,
  )
  if (!match) return null

  return {
    host: normalizedHost,
    route: match,
    fixture,
  }
}
