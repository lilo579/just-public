import http from "node:http"
import net from "node:net"

import {
  HOST_FIXTURES,
  HOST_MALFORMED,
  HOST_UNKNOWN,
} from "../fixtures/poc-canonical-payloads.mjs"

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
 * Local public-site-payload mock for POC Slice 4.
 * Routes by query `host`; never calls Hub/Supabase.
 */
export function startCanonicalPayloadMock() {
  /** @type {{ pathname: string, host: string | null, mode: string | null, hasAuth: boolean }[]} */
  const calls = []

  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://127.0.0.1")
    const host = u.searchParams.get("host")
    const mode = u.searchParams.get("mode")
    calls.push({
      pathname: u.pathname,
      host,
      mode,
      hasAuth: Boolean(req.headers.authorization),
    })

    if (!host || host === HOST_UNKNOWN) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" })
      res.end(JSON.stringify({ error: "unknown_host", code: "unknown_host" }))
      return
    }

    if (host === HOST_MALFORMED) {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" })
      res.end("{not-valid-json")
      return
    }

    const fixture = HOST_FIXTURES[host]
    if (!fixture) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" })
      res.end(JSON.stringify({ error: "unknown_host", code: "unknown_host" }))
      return
    }

    res.writeHead(200, { "content-type": "application/json; charset=utf-8" })
    res.end(JSON.stringify(fixture))
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
