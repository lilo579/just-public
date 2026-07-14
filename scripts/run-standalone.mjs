/**
 * Thin process wrapper for standalone Astro.
 * Adapter already binds HOST/PORT and logs listen addresses.
 * This only adds predictable process signal exit for containers.
 */
process.on("SIGTERM", () => {
  console.log("[just-public] received SIGTERM")
  process.exit(0)
})
process.on("SIGINT", () => {
  console.log("[just-public] received SIGINT")
  process.exit(0)
})
process.on("uncaughtException", (err) => {
  console.error("[just-public] uncaughtException", err instanceof Error ? err.message : err)
  process.exit(1)
})
process.on("unhandledRejection", (reason) => {
  console.error(
    "[just-public] unhandledRejection",
    reason instanceof Error ? reason.message : reason,
  )
  process.exit(1)
})

await import("../dist/server/entry.mjs")
