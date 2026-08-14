/**
 * Coming Soon lead form is honest: copy may exist, capture is opt-in.
 * Never render UI that claims success without a backend.
 *
 * @param {Record<string, unknown> | null | undefined} config
 * @returns {Record<string, unknown> | null}
 */
export function resolveComingSoonLeadForm(config) {
  if (!config || typeof config !== "object") return null
  if (config.leadCaptureEnabled !== true) return null
  const form = config.leadForm
  if (!form || typeof form !== "object" || Array.isArray(form)) return null
  return form
}
