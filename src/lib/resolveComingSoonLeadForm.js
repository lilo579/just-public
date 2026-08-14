/**
 * Coming Soon lead form is honest: copy may exist, capture is opt-in.
 * Never render UI that claims success without a backend.
 * Used by the homepage builder and by ComingSoonPage (component-boundary defense).
 *
 * @param {unknown} form
 */
export function isComingSoonLeadFormCopy(form) {
  return Boolean(form && typeof form === "object" && !Array.isArray(form))
}

/**
 * @param {unknown} leadCaptureEnabled
 * @param {unknown} leadForm
 */
export function shouldRenderComingSoonLeadForm(leadCaptureEnabled, leadForm) {
  return leadCaptureEnabled === true && isComingSoonLeadFormCopy(leadForm)
}

/**
 * @param {Record<string, unknown> | null | undefined} config
 * @returns {Record<string, unknown> | null}
 */
export function resolveComingSoonLeadForm(config) {
  if (!config || typeof config !== "object") return null
  if (!shouldRenderComingSoonLeadForm(config.leadCaptureEnabled, config.leadForm)) {
    return null
  }
  return config.leadForm
}
