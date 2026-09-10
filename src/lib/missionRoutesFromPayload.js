/**
 * Extract allowlisted mission routes from a public homepage payload.
 * Pure — safe for unit tests without Worker/payload fetch deps.
 */

/**
 * @param {unknown} payload
 * @returns {Array<Record<string, unknown>>}
 */
export function missionRoutesFromPayload(payload) {
  if (!payload || typeof payload !== "object") return []
  const root = /** @type {Record<string, unknown>} */ (payload)
  if (Array.isArray(root.routes)) return root.routes
  const source = root.source
  if (source && typeof source === "object") {
    const s = /** @type {Record<string, unknown>} */ (source)
    if (Array.isArray(s.missionRoutes)) return s.missionRoutes
    const mission = s.mission
    if (mission && typeof mission === "object") {
      const m = /** @type {Record<string, unknown>} */ (mission)
      if (Array.isArray(m.routes)) return m.routes
    }
  }
  return []
}
