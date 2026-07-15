import http from "node:http"
import net from "node:net"

import {
  HOST_FIXTURES,
  HOST_MALFORMED,
  HOST_UNKNOWN,
  TENANT_ALPHA,
  TENANT_BETA,
  TENANT_GAMMA,
} from "../fixtures/poc-canonical-payloads.mjs"

const TENANT_BY_HOST = {
  [TENANT_ALPHA.host]: TENANT_ALPHA,
  [TENANT_BETA.host]: TENANT_BETA,
  [TENANT_GAMMA.host]: TENANT_GAMMA,
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
export function startCanonicalPayloadMock() {
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

  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1")
    const host = u.searchParams.get("host")
    const mode = u.searchParams.get("mode")
    const timestamp = new Date().toISOString()
    const hasAuth = Boolean(req.headers.authorization)

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

    const fixture = HOST_FIXTURES[host]
    if (!fixture) {
      respond(404, JSON.stringify({ error: "unknown_host", code: "unknown_host" }))
      return
    }

    const meta = TENANT_BY_HOST[host]
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
