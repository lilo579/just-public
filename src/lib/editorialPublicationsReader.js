/**
 * Shared Public reader for `public_get_publications_by_host`.
 * Platform-named outcomes and logs — no Dorot prefixes.
 */

export const EDITORIAL_PUBLICATIONS_CONTRACT_VERSION = "v1"
export const EDITORIAL_PUBLICATIONS_TIMEOUT_MS = 700
export const EDITORIAL_PUBLICATIONS_FRESH_TTL_MS = 60_000
export const EDITORIAL_PUBLICATIONS_STALE_MS = 24 * 60 * 60 * 1000

const STAGE_TOKEN_PATTERN = /^[a-z][a-z0-9_]{0,39}$/
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PUBLICATION_STATUSES = new Set(["upcoming", "active", "published"])

/**
 * @typedef {"ok"|"empty"|"no_document"|"timeout"|"http_error"|"invalid"|"stale"} EditorialPublicationsOutcome
 */

/**
 * @param {string} host
 */
export function editorialPublicationsCacheKey(host) {
  return `just.publications:v=${EDITORIAL_PUBLICATIONS_CONTRACT_VERSION}:host=${encodeURIComponent(
    String(host || "").toLowerCase(),
  )}`
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isNonEmptyString(value, max) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max
}

function isCover(value) {
  if (value === null) return true
  return (
    isPlainObject(value) &&
    isNonEmptyString(value.url, 2048) &&
    isNonEmptyString(value.alt, 300) &&
    Object.keys(value).every((k) => k === "url" || k === "alt")
  )
}

function isFunding(value) {
  if (value === null) return true
  return (
    isPlainObject(value) &&
    Number.isInteger(value.current) &&
    value.current >= 0 &&
    Number.isInteger(value.goal) &&
    value.goal >= 1 &&
    Object.keys(value).every((k) => k === "current" || k === "goal")
  )
}

function isStage(value) {
  return (
    isPlainObject(value) &&
    typeof value.token === "string" &&
    STAGE_TOKEN_PATTERN.test(value.token) &&
    isNonEmptyString(value.label, 200) &&
    Number.isInteger(value.position) &&
    value.position >= 0 &&
    Object.keys(value).every((k) => k === "token" || k === "label" || k === "position")
  )
}

function isPublication(value) {
  if (!isPlainObject(value)) return false
  const keys = Object.keys(value)
  const expected = [
    "slug",
    "title",
    "subtitle",
    "description",
    "status",
    "cover",
    "funding",
    "released_at",
    "current_stage_token",
    "stages",
  ]
  if (keys.length !== expected.length || expected.some((k) => !keys.includes(k))) return false
  if (!isNonEmptyString(value.slug, 200) || !SLUG_PATTERN.test(value.slug.trim())) return false
  if (!isNonEmptyString(value.title, 200)) return false
  if (!(value.subtitle === null || isNonEmptyString(value.subtitle, 200))) return false
  if (
    !(
      value.description === null ||
      (typeof value.description === "string" &&
        value.description.length >= 1 &&
        value.description.length <= 4000)
    )
  ) {
    return false
  }
  if (!PUBLICATION_STATUSES.has(value.status)) return false
  if (!isCover(value.cover) || !isFunding(value.funding)) return false
  if (
    !(
      value.released_at === null ||
      (typeof value.released_at === "string" && !Number.isNaN(Date.parse(value.released_at)))
    )
  ) {
    return false
  }
  if (
    !(
      value.current_stage_token === null ||
      (typeof value.current_stage_token === "string" &&
        STAGE_TOKEN_PATTERN.test(value.current_stage_token))
    )
  ) {
    return false
  }
  if (!Array.isArray(value.stages) || !value.stages.every(isStage)) return false
  return true
}

function checkInvariants(document) {
  const issues = []
  if (document.active && document.active.status !== "active") issues.push("active.status")
  document.upcoming.forEach((p, i) => {
    if (p.status !== "upcoming") issues.push(`upcoming[${i}].status`)
  })
  document.published.forEach((p, i) => {
    if (p.status !== "published") issues.push(`published[${i}].status`)
  })

  const all = [
    ...(document.active ? [document.active] : []),
    ...document.upcoming,
    ...document.published,
  ]
  const slugs = all.map((p) => p.slug)
  for (const slug of new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))) {
    issues.push(`duplicate slug ${slug}`)
  }

  for (const publication of all) {
    const tokens = publication.stages.map((s) => s.token)
    const positions = publication.stages.map((s) => s.position)
    if (new Set(tokens).size !== tokens.length) issues.push(`${publication.slug}.stages.token`)
    if (new Set(positions).size !== positions.length) {
      issues.push(`${publication.slug}.stages.position`)
    }
    const ordered = positions.every((p, i) => i === 0 || p > positions[i - 1])
    if (!ordered) issues.push(`${publication.slug}.stages.unordered`)
    if (
      publication.current_stage_token !== null &&
      !tokens.includes(publication.current_stage_token)
    ) {
      issues.push(`${publication.slug}.current_stage_token`)
    }
  }
  return issues
}

/**
 * @param {unknown} payload
 * @returns {{ ok: true, document: object } | { ok: false, issues: string[] }}
 */
export function parseEditorialPublicationsDocument(payload) {
  if (!isPlainObject(payload)) return { ok: false, issues: ["<root>:type"] }
  const keys = Object.keys(payload)
  if (
    keys.length !== 3 ||
    !keys.includes("active") ||
    !keys.includes("upcoming") ||
    !keys.includes("published")
  ) {
    return { ok: false, issues: ["<root>:shape"] }
  }
  if (!(payload.active === null || isPublication(payload.active))) {
    return { ok: false, issues: ["active"] }
  }
  if (!Array.isArray(payload.upcoming) || !payload.upcoming.every(isPublication)) {
    return { ok: false, issues: ["upcoming"] }
  }
  if (!Array.isArray(payload.published) || !payload.published.every(isPublication)) {
    return { ok: false, issues: ["published"] }
  }
  const issues = checkInvariants(payload)
  if (issues.length) return { ok: false, issues }
  return { ok: true, document: payload }
}

export function isEmptyEditorialPublicationsDocument(document) {
  return (
    document &&
    document.active === null &&
    Array.isArray(document.upcoming) &&
    document.upcoming.length === 0 &&
    Array.isArray(document.published) &&
    document.published.length === 0
  )
}

/**
 * @param {{
 *   outcome: EditorialPublicationsOutcome
 *   host?: string
 *   ms?: number
 *   cache?: string
 *   issues?: string[]
 * }} entry
 */
export function logEditorialPublications(entry) {
  const parts = [`outcome=${entry.outcome}`]
  if (entry.host) parts.push(`host=${entry.host}`)
  if (typeof entry.ms === "number") parts.push(`ms=${entry.ms}`)
  if (entry.cache) parts.push(`cache=${entry.cache}`)
  if (entry.issues?.length) parts.push(`issues=${entry.issues.join(",")}`)
  console.info(`[just.publications] ${parts.join(" ")}`)
}

/**
 * @param {{
 *   supabase?: { rpc?: Function } | null
 *   host?: unknown
 *   timeoutMs?: number
 *   cache?: { read: Function, write: Function } | null
 *   now?: () => number
 *   log?: boolean
 * }} input
 */
export async function readEditorialPublicationsByHost(input = {}) {
  const host = typeof input.host === "string" ? input.host.trim().toLowerCase() : ""
  const supabase = input.supabase
  const timeoutMs =
    typeof input.timeoutMs === "number" && input.timeoutMs > 0
      ? input.timeoutMs
      : EDITORIAL_PUBLICATIONS_TIMEOUT_MS
  const now = typeof input.now === "function" ? input.now : () => Date.now()
  const started = now()
  const elapsed = () => Math.max(0, now() - started)
  const shouldLog = input.log !== false

  /** @type {(read: object) => object} */
  const finish = (read) => {
    if (shouldLog) {
      logEditorialPublications({
        outcome: read.outcome,
        host,
        ms: read.ms,
        cache: read.cache,
        issues: read.issues,
      })
    }
    return read
  }

  if (!host || !supabase || typeof supabase.rpc !== "function") {
    return finish({
      document: null,
      outcome: "http_error",
      cache: "none",
      ms: elapsed(),
      issues: ["missing_client_or_host"],
    })
  }

  const cacheKey = editorialPublicationsCacheKey(host)
  let cached = null
  if (input.cache) {
    try {
      cached = await input.cache.read(cacheKey)
    } catch {
      cached = null
    }
  }
  const age = cached ? now() - cached.storedAt : Number.POSITIVE_INFINITY
  if (cached && age >= 0 && age < EDITORIAL_PUBLICATIONS_FRESH_TTL_MS) {
    const parsed = parseEditorialPublicationsDocument(cached.document)
    if (parsed.ok) {
      const outcome = isEmptyEditorialPublicationsDocument(parsed.document) ? "empty" : "ok"
      return finish({
        document: parsed.document,
        outcome,
        cache: "hit",
        ms: elapsed(),
        issues: [],
      })
    }
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const builder = supabase.rpc("public_get_publications_by_host", { p_host: host })
    if (!builder || typeof builder.abortSignal !== "function") {
      throw new Error("missing_abort_signal")
    }
    const result = await builder.abortSignal(controller.signal)
    if (controller.signal.aborted) {
      if (cached && age >= 0 && age < EDITORIAL_PUBLICATIONS_STALE_MS) {
        const parsed = parseEditorialPublicationsDocument(cached.document)
        if (parsed.ok) {
          return finish({
            document: parsed.document,
            outcome: "stale",
            cache: "stale",
            ms: elapsed(),
            issues: [],
          })
        }
      }
      return finish({
        document: null,
        outcome: timedOut ? "timeout" : "http_error",
        cache: "none",
        ms: elapsed(),
        issues: [],
      })
    }

    if (!result || typeof result !== "object") {
      return finish({
        document: null,
        outcome: "http_error",
        cache: "none",
        ms: elapsed(),
        issues: ["bad_result"],
      })
    }

    const { data, error } = result
    if (error) {
      if (cached && age >= 0 && age < EDITORIAL_PUBLICATIONS_STALE_MS) {
        const parsed = parseEditorialPublicationsDocument(cached.document)
        if (parsed.ok) {
          return finish({
            document: parsed.document,
            outcome: "stale",
            cache: "stale",
            ms: elapsed(),
            issues: [],
          })
        }
      }
      return finish({
        document: null,
        outcome: "http_error",
        cache: "none",
        ms: elapsed(),
        issues: ["rpc_error"],
      })
    }

    if (data === null) {
      return finish({
        document: null,
        outcome: "no_document",
        cache: "miss",
        ms: elapsed(),
        issues: [],
      })
    }

    const parsed = parseEditorialPublicationsDocument(data)
    if (!parsed.ok) {
      return finish({
        document: null,
        outcome: "invalid",
        cache: "miss",
        ms: elapsed(),
        issues: parsed.issues,
      })
    }

    if (input.cache) {
      try {
        await input.cache.write(cacheKey, { document: data, storedAt: now() })
      } catch {
        // best-effort
      }
    }

    const outcome = isEmptyEditorialPublicationsDocument(parsed.document) ? "empty" : "ok"
    return finish({
      document: parsed.document,
      outcome,
      cache: "miss",
      ms: elapsed(),
      issues: [],
    })
  } catch {
    if (cached && age >= 0 && age < EDITORIAL_PUBLICATIONS_STALE_MS) {
      const parsed = parseEditorialPublicationsDocument(cached.document)
      if (parsed.ok) {
        return finish({
          document: parsed.document,
          outcome: "stale",
          cache: "stale",
          ms: elapsed(),
          issues: [],
        })
      }
    }
    return finish({
      document: null,
      outcome: timedOut ? "timeout" : "http_error",
      cache: "none",
      ms: elapsed(),
      issues: [],
    })
  } finally {
    clearTimeout(timer)
  }
}
