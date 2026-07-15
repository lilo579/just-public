import assert from "node:assert/strict"
import test from "node:test"
import { smokeCloudflarePreview } from "../scripts/ci/smoke-cloudflare-preview.mjs"

function htmlFor(company, color) {
  return `<!doctype html><html><body
    data-renderer="canonical"
    data-lead-form-safe="true"
    style="--site-color-primary:${color}">
    <h1>${company}</h1>
    <link rel="stylesheet" href="/_astro/index.NZuRlFGq.css" />
  </body></html>`
}

test("CF-006 smokeCloudflarePreview: mocked Preview matrix PASS", async () => {
  /** @type {Map<string, {status:number, body:string, headers?:Record<string,string>}>} */
  const map = new Map([
    [
      "/health",
      {
        status: 200,
        body: '{"status":"ok","service":"just-public"}',
        headers: { "x-robots-tag": "noindex" },
      },
    ],
    [
      "/?host=alpha.justwebsites.com.br",
      { status: 200, body: htmlFor("Alpha Consulting", "#112233") },
    ],
    [
      "/?host=beta.justwebsites.com.br",
      { status: 200, body: htmlFor("Beta Studio", "#aa5500") },
    ],
    [
      "/?host=gamma.justwebsites.com.br",
      { status: 200, body: htmlFor("Gamma Labs", "#008866") },
    ],
    ["/?host=unknown.example.test", { status: 404, body: "missing" }],
    ["/?host=https://evil.example", { status: 400, body: "bad" }],
    ["/_astro/index.NZuRlFGq.css", { status: 200, body: "body{}" }],
    ["/favicon.ico", { status: 200, body: "ico" }],
    ["/_worker.js/index.js", { status: 404, body: "no" }],
    ["/_routes.json", { status: 404, body: "no" }],
    ["/_astro/does-not-exist-cf006.css", { status: 404, body: "no" }],
  ])

  const original = globalThis.fetch
  globalThis.fetch = async (input) => {
    const href = String(input)
    const path = href.replace(/^https:\/\/example\.test/, "")
    const hit = map.get(path)
    if (!hit) throw new Error(`unexpected fetch ${path}`)
    return {
      status: hit.status,
      headers: new Headers(hit.headers || {}),
      text: async () => hit.body,
    }
  }

  try {
    const out = await smokeCloudflarePreview("https://example.test", {
      timeoutMs: 1000,
      log: () => {},
    })
    assert.equal(out.ok, true)
    assert.equal(out.cssPath, "/_astro/index.NZuRlFGq.css")
  } finally {
    globalThis.fetch = original
  }
})

test("CF-006 smokeCloudflarePreview: cross-tenant fails closed", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (input) => {
    const href = String(input)
    if (href.endsWith("/health")) {
      return {
        status: 200,
        headers: new Headers({ "x-robots-tag": "noindex" }),
        text: async () => '{"status":"ok","service":"just-public"}',
      }
    }
    // Alpha page incorrectly includes Beta company
    return {
      status: 200,
      headers: new Headers(),
      text: async () =>
        htmlFor("Alpha Consulting", "#112233").replace(
          "</h1>",
          "</h1><p>Beta Studio</p>",
        ),
    }
  }
  try {
    await assert.rejects(
      () =>
        smokeCloudflarePreview("https://example.test", {
          timeoutMs: 1000,
          log: () => {},
        }),
      /cross-tenant/,
    )
  } finally {
    globalThis.fetch = original
  }
})
