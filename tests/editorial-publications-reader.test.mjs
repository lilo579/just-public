import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  EDITORIAL_PUBLICATIONS_CONTRACT_VERSION,
  editorialPublicationsCacheKey,
  parseEditorialPublicationsDocument,
  readEditorialPublicationsByHost,
} from "../src/lib/editorialPublicationsReader.js"

const validDocument = {
  active: {
    slug: "corredor-verde-pinheiros",
    title: "Corredor verde Pinheiros",
    subtitle: "Fase 2",
    description: "Replantio de margem.",
    status: "active",
    cover: { url: "https://example.com/c.jpg", alt: "Margem" },
    funding: { current: 10, goal: 100 },
    released_at: null,
    current_stage_token: "replantio",
    stages: [
      { token: "diagnostico", label: "Diagnóstico", position: 1 },
      { token: "replantio", label: "Replantio", position: 2 },
    ],
  },
  upcoming: [],
  published: [],
}

function rpcClient(payload, { delayMs = 0, error = null } = {}) {
  return {
    rpc() {
      const promise = new Promise((resolve, reject) => {
        const run = () => {
          if (error) resolve({ data: null, error })
          else resolve({ data: payload, error: null })
        }
        if (delayMs > 0) setTimeout(run, delayMs)
        else run()
      })
      return {
        abortSignal(signal) {
          if (signal?.aborted) {
            return Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          }
          return new Promise((resolve, reject) => {
            const onAbort = () => {
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
            }
            if (signal) signal.addEventListener("abort", onAbort, { once: true })
            promise.then(
              (value) => {
                if (signal) signal.removeEventListener("abort", onAbort)
                if (signal?.aborted) onAbort()
                else resolve(value)
              },
              (err) => {
                if (signal) signal.removeEventListener("abort", onAbort)
                reject(err)
              },
            )
          })
        },
      }
    },
  }
}

describe("editorialPublicationsReader", () => {
  it("cache key includes contract v1", () => {
    const key = editorialPublicationsCacheKey("www.canonical-f4.example.test")
    assert.match(key, new RegExp(`v=${EDITORIAL_PUBLICATIONS_CONTRACT_VERSION}`))
    assert.match(key, /host=www\.canonical-f4\.example\.test/)
  })

  it("validates real RPC shape and rejects invented fields", () => {
    assert.equal(parseEditorialPublicationsDocument(validDocument).ok, true)
    assert.equal(
      parseEditorialPublicationsDocument({
        ...validDocument,
        contractVersion: "v1",
      }).ok,
      false,
    )
  })

  it("returns ok for valid rpc payload", async () => {
    const read = await readEditorialPublicationsByHost({
      host: "www.canonical-f4.example.test",
      supabase: rpcClient(validDocument),
      log: false,
    })
    assert.equal(read.outcome, "ok")
    assert.equal(read.document.active.slug, "corredor-verde-pinheiros")
  })

  it("returns empty / no_document / invalid / timeout / http_error / stale", async () => {
    const empty = await readEditorialPublicationsByHost({
      host: "empty.test",
      supabase: rpcClient({ active: null, upcoming: [], published: [] }),
      log: false,
    })
    assert.equal(empty.outcome, "empty")

    const none = await readEditorialPublicationsByHost({
      host: "none.test",
      supabase: rpcClient(null),
      log: false,
    })
    assert.equal(none.outcome, "no_document")

    const invalid = await readEditorialPublicationsByHost({
      host: "bad.test",
      supabase: rpcClient({ active: { title: "x" }, upcoming: [], published: [] }),
      log: false,
    })
    assert.equal(invalid.outcome, "invalid")

    const timeout = await readEditorialPublicationsByHost({
      host: "slow.test",
      supabase: rpcClient(validDocument, { delayMs: 50 }),
      timeoutMs: 5,
      log: false,
    })
    assert.equal(timeout.outcome, "timeout")

    const httpError = await readEditorialPublicationsByHost({
      host: "err.test",
      supabase: rpcClient(null, { error: { message: "boom" } }),
      log: false,
    })
    assert.equal(httpError.outcome, "http_error")

    const memory = new Map()
    const cache = {
      async read(key) {
        return memory.get(key) ?? null
      },
      async write(key, entry) {
        memory.set(key, entry)
      },
    }
    let now = 1_000
    await readEditorialPublicationsByHost({
      host: "stale.test",
      supabase: rpcClient(validDocument),
      cache,
      now: () => now,
      log: false,
    })
    now = 1_000 + 120_000
    const stale = await readEditorialPublicationsByHost({
      host: "stale.test",
      supabase: rpcClient(null, { error: { message: "down" } }),
      cache,
      now: () => now,
      log: false,
    })
    assert.equal(stale.outcome, "stale")
    assert.ok(stale.document)
  })
})
