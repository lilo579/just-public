/**
 * Allowlisted multi-route foundation for F4 mission tenants.
 * No arbitrary handlers — only explicit route kinds + declared paths.
 *
 * Production: pass `routes` from the fetched public payload (payload.routes
 * or source.mission.routes). Fixture path remains for synthetic hosts when
 * routesFromPayload is omitted.
 */

import {
  FIXTURE_SYNTHETIC_F4,
  SYNTHETIC_F4_HOST,
} from "../poc/syntheticF4MissionTenant.js"
import { resolvePocFixturePayload } from "../poc/publicSiteFixtures.js"

/**
 * @typedef {{ kind: string, path: string, title?: string, heading?: string, body?: string }} MissionRoute
 */

/**
 * @param {string} host
 * @param {string} path
 * @param {"content_page"|"form_signup_shell"} kind
 * @param {MissionRoute[] | null | undefined} [routesFromPayload]
 */
export function resolveAllowlistedMissionRoute(host, path, kind, routesFromPayload) {
  const normalizedHost = typeof host === "string" ? host.trim().toLowerCase() : ""
  const normalizedPath = typeof path === "string" ? path.split("?")[0].split("#")[0] : ""
  if (!normalizedHost || !normalizedPath.startsWith("/")) return null

  /** @type {MissionRoute[]} */
  let routes = []
  /** @type {unknown} */
  let fixture = null

  if (Array.isArray(routesFromPayload)) {
    routes = routesFromPayload
  } else {
    fixture =
      normalizedHost === SYNTHETIC_F4_HOST
        ? FIXTURE_SYNTHETIC_F4
        : resolvePocFixturePayload(normalizedHost)

    routes = Array.isArray(fixture?.routes)
      ? fixture.routes
      : Array.isArray(fixture?.source?.missionRoutes)
        ? fixture.source.missionRoutes
        : Array.isArray(fixture?.source?.mission?.routes)
          ? fixture.source.mission.routes
          : []
  }

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
