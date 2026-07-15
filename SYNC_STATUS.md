# SYNC_STATUS — just-public

Updated: 2026-07-15 (CF-006 — fix CI build→test order; second remote run pending)

## Source of truth

- Local pending commit: build-before-test workflow fix.
- Canonical published commit before this fix: **1b5bfb1** (`origin/main`).
- Hub: CF-006A COMPLETE (`just-auth-nexus` @ `b7009e7`); CF-006 slice not yet COMPLETE.

## Current state

### Remote Worker

| Field | Value |
|-------|--------|
| Worker | `just-public-poc` |
| Active Deployment | Bootstrap `3047d28b-…ef4f` @ **100%** (`a0368c3e-…`) |
| First CI Version | `f3d2721d-30ef-4a12-9fca-1a463d260951` (**0%** traffic) |
| Preview (1º run) | `https://f3d2721d-just-public-poc.lilo579.workers.dev` |
| `workers_dev` | false |
| Routes / Domains / DNS | 0 / 0 / unchanged |

### CF-006 — Controlled CI/CD

| Item | Value |
|------|--------|
| Workflow | `.github/workflows/cloudflare-preview-version.yml` |
| Trigger | `workflow_dispatch` only |
| First remote run | **PASS** — [29440565313](https://github.com/lilo579/just-public/actions/runs/29440565313) |
| Workerd coverage (1º run) | **incomplete** — tests skipped (`dist/_worker.js` missing; test ran before build) |
| Fix | order **build → test** (policy + tests enforce) |
| Second remote run | **pending** after this push |

Pipeline (corrected):

```
checkout → Node 22 → npm ci → policy → npm run build → npm test
→ wrangler deploy --dry-run → wrangler versions upload
→ parse → smoke → assert Deployment unchanged → summary + artifact
```

## Warnings

### Robots

workerd: `noindex, nofollow` · Preview URL: `noindex` (non-blocking).

### Intentional skip remaining

`Node contingency standalone /health` skips when `@astrojs/cloudflare` does not emit `dist/server/entry.mjs` — expected, unrelated to build order.

## Next steps

1. Push fix · second `workflow_dispatch`.
2. Confirm workerd tests execute (no build-missing skips).
3. Hub CF-006 evidence report → CF-006 COMPLETE / CF-007 READY.

## Do not overwrite

- Hub contracts · customer DNS · Hub finance scripts.
