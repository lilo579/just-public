import http from "node:http"
import net from "node:net"

import {
  HOST_AUTHORITY_UNAVAILABLE,
  HOST_FIXTURES,
  HOST_MALFORMED,
  HOST_UNKNOWN,
  SEO001_TENANT_A,
  SEO001_TENANT_B,
  TENANT_ALPHA,
  TENANT_BETA,
  TENANT_GAMMA,
} from "../fixtures/poc-canonical-payloads.mjs"

const TENANT_BY_HOST = {
  [TENANT_ALPHA.host]: TENANT_ALPHA,
  [TENANT_BETA.host]: TENANT_BETA,
  [TENANT_GAMMA.host]: TENANT_GAMMA,
  [SEO001_TENANT_A.primary]: SEO001_TENANT_A,
  [SEO001_TENANT_A.alias]: SEO001_TENANT_A,
  [SEO001_TENANT_B.primary]: SEO001_TENANT_B,
  [SEO001_TENANT_B.alias]: SEO001_TENANT_B,
}

export async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      if (!addr || typeof addr === "string") {
        server.close()
        reject(new Error("no port"))
        return
      }
      const { port } = addr
      server.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

/**
 * Local public-site-payload mock for POC slices.
 * Routes by query `host`; never calls Hub/Supabase.
 * Each call records: timestamp, host, tenant, mode, status.
 */
export function startCanonicalPayloadMock(
  extraHostFixtures = {},
  extraTenantByHost = {},
  options = {},
) {
  /**
   * @type {{
   *   timestamp: string
   *   pathname: string
   *   host: string | null
   *   tenant: string | null
   *   tenantKey: string | null
   *   mode: string | null
   *   status: number
   *   hasAuth: boolean
   * }[]}
   */
  const calls = []

  const rpcProductsByHost = options.rpcProductsByHost ?? {}
  const rpcErrorHosts = new Set(options.rpcErrorHosts ?? [])

  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1")
    const timestamp = new Date().toISOString()
    const hasAuth = Boolean(req.headers.authorization)

    if (u.pathname === "/rest/v1/rpc/public_get_products_by_host") {
      /** @type {Buffer[]} */
      const chunks = []
      req.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk))
      })
      req.on("end", () => {
        let pHost = ""
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")
          pHost = typeof body?.p_host === "string" ? body.p_host.trim().toLowerCase() : ""
        } catch {
          pHost = ""
        }
        calls.push({
          timestamp,
          pathname: u.pathname,
          host: pHost || null,
          tenant: null,
          tenantKey: null,
          mode: "rpc",
          status: rpcErrorHosts.has(pHost) ? 500 : 200,
          hasAuth,
        })
        if (rpcErrorHosts.has(pHost)) {
          res.writeHead(500, { "content-type": "application/json; charset=utf-8" })
          res.end(JSON.stringify({ message: "rpc_failed", code: "rpc_failed" }))
          return
        }
        const rows = rpcProductsByHost[pHost]
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" })
        res.end(JSON.stringify(Array.isArray(rows) ? rows : []))
      })
      return
    }

    const host = u.searchParams.get("host")
    const mode = u.searchParams.get("mode")

    /** @param {number} status @param {string} body @param {string|null} tenant @param {string|null} tenantKey */
    const respond = (status, body, tenant = null, tenantKey = null) => {
      calls.push({
        timestamp,
        pathname: u.pathname,
        host,
        tenant,
        tenantKey,
        mode,
        status,
        hasAuth,
      })
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" })
      res.end(body)
    }

    if (!host || host === HOST_UNKNOWN) {
      respond(404, JSON.stringify({ error: "unknown_host", code: "unknown_host" }))
      return
    }

    if (host === HOST_MALFORMED) {
      respond(200, "{not-valid-json")
      return
    }

    if (host === HOST_AUTHORITY_UNAVAILABLE) {
      respond(503, JSON.stringify({ error: "canonical_authority_unavailable" }))
      return
    }

    const fixture = extraHostFixtures[host] ?? HOST_FIXTURES[host]
    if (!fixture) {
      respond(404, JSON.stringify({ error: "unknown_host", code: "unknown_host" }))
      return
    }

    const meta = extraTenantByHost[host] ?? TENANT_BY_HOST[host]
    const tenant = typeof fixture.tenantId === "string" ? fixture.tenantId : null
    const tenantKey = meta?.key ?? null
    respond(200, JSON.stringify(fixture), tenant, tenantKey)
  })

  return {
    calls,
    async listen() {
      const port = await freePort()
      await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve))
      return {
        port,
        baseUrl: `http://127.0.0.1:${port}/functions/v1/public-site-payload`,
      }
    },
    async close() {
      await new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      )
    },
  }
}
