import test from "node:test"
import assert from "node:assert/strict"

import {
  HostResolutionError,
  normalizeRequestHostname,
  resolveRequestHost,
} from "../src/lib/publicHomepageHelpers.js"

test("normalizeRequestHostname: lowercase, strip port, strip trailing dot", () => {
  assert.deepEqual(normalizeRequestHostname("ALPHA.JUSTWEBSITES.COM.BR"), {
    ok: true,
    host: "alpha.justwebsites.com.br",
  })
  assert.deepEqual(normalizeRequestHostname("alpha.justwebsites.com.br:8791"), {
    ok: true,
    host: "alpha.justwebsites.com.br",
  })
  assert.deepEqual(normalizeRequestHostname("alpha.justwebsites.com.br."), {
    ok: true,
    host: "alpha.justwebsites.com.br",
  })
})

test("normalizeRequestHostname rejects URL, path, empty, whitespace", () => {
  assert.equal(normalizeRequestHostname("").ok, false)
  assert.equal(normalizeRequestHostname("https://alpha.justwebsites.com.br").ok, false)
  assert.equal(normalizeRequestHostname("alpha.justwebsites.com.br/path").ok, false)
  assert.equal(normalizeRequestHostname("alpha host").ok, false)
})

test("URL.hostname preferred; Host is loopback fallback; XFH ignored", () => {
  const urlWins = new Request("https://alpha.justwebsites.com.br/", {
    headers: {
      host: "beta.justwebsites.com.br",
      "x-forwarded-host": "evil.example.com",
    },
  })
  assert.equal(resolveRequestHost(urlWins, new URLSearchParams()), "alpha.justwebsites.com.br")

  const hostFallback = new Request("http://127.0.0.1:8793/", {
    headers: { host: "tenant.com.br" },
  })
  assert.equal(resolveRequestHost(hostFallback, new URLSearchParams()), "tenant.com.br")

  const www = new Request("https://www.tenant.com.br/", {
    headers: { host: "tenant.com.br" },
  })
  assert.equal(resolveRequestHost(www, new URLSearchParams()), "www.tenant.com.br")
})

test("?host= override has highest precedence and is normalized", () => {
  const req = new Request("https://beta.justwebsites.com.br/", {
    headers: { host: "beta.justwebsites.com.br" },
  })
  assert.equal(
    resolveRequestHost(req, new URLSearchParams("host=ALPHA.JUSTWEBSITES.COM.BR.")),
    "alpha.justwebsites.com.br",
  )
})

test("invalid host throws before any fetch responsibility", () => {
  const req = new Request("https://alpha.justwebsites.com.br/")
  assert.throws(
    () => resolveRequestHost(req, new URLSearchParams("host=")),
    (err) => err instanceof HostResolutionError && err.reason === "empty",
  )
  assert.throws(
    () =>
      resolveRequestHost(req, new URLSearchParams("host=https://alpha.justwebsites.com.br")),
    (err) => err instanceof HostResolutionError && err.reason === "has_protocol",
  )
  assert.throws(
    () =>
      resolveRequestHost(req, new URLSearchParams("host=alpha.justwebsites.com.br/path")),
    (err) => err instanceof HostResolutionError && err.reason === "has_path_or_query",
  )
  assert.throws(
    () => resolveRequestHost(req, new URLSearchParams("host=alpha host")),
    (err) => err instanceof HostResolutionError && err.reason === "whitespace",
  )
})
