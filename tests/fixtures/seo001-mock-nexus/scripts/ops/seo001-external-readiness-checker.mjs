export async function runExternalReadinessChecks() {
  return { ok: true, checks: [{ id: "mock", ok: true }], failed: [] }
}
