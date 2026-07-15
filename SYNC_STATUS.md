# SYNC_STATUS — just-public

Updated: 2026-07-15 (IMPLEMENTATION-001 **CF-006** — controlled CI/CD workflow, local implementation)

## Source of truth

- Local git working tree (uncommitted CF-006 changes).
- Canonical published commit: **7932a67** (`origin/main`).
- Hub: IMPLEMENTATION-001 CF-001…CF-005 COMPLETE (`just-auth-nexus` @ `f742849`).

## Current state

### Remote Worker (unchanged by CF-006 implementation)

| Field | Value |
|-------|--------|
| Worker | `just-public-poc` |
| Active Deployment | Bootstrap `3047d28b-9830-4a10-8104-6d783f57ef4f` @ **100%** (post CF-005 rollback) |
| CF-004 Version | `166faa56-eb39-4f6d-9458-f8232e927546` retained · Preview intact |
| `workers_dev` | false (hostname 1042) |
| `previews_enabled` | true |
| Routes / Domains / DNS | 0 / 0 / unchanged |

### CF-006 — Controlled CI/CD

| Item | Value |
|------|--------|
| Workflow | `.github/workflows/cloudflare-preview-version.yml` |
| Trigger | `workflow_dispatch` only |
| Environment | `cloudflare-preview` (GitHub) |
| Commands | explicit `npx wrangler` (not default wrangler-action `deploy`) |
| Secret | `CLOUDFLARE_API_TOKEN` — **not yet configured** (manual Dashboard token required) |
| Variable | `CLOUDFLARE_ACCOUNT_ID` — configured (name only in docs) |
| Promotion | **never** in this workflow |
| Remote run | **NOT EXECUTED** (awaiting commit/push + token) |

Pipeline:

```
checkout → Node 22 → npm ci → policy gate → npm test → npm run build
→ wrangler deploy --dry-run → wrangler versions upload
→ parse Version ID + Preview URL → smoke fixtures → assert Deployment unchanged
→ summary + cf-preview-metadata.json artifact (7d)
```

Helpers: `scripts/ci/*.mjs` · Tests: `tests/cf006-*.test.mjs`

## Warnings

### Robots

| Surface | Observed |
|---------|----------|
| workerd | `noindex, nofollow` |
| Preview URL | `noindex` |

Non-blocking (CF-004 Issue #001).

### CF-006 remote gate

Until `CLOUDFLARE_API_TOKEN` is set and the workflow is pushed:

- no CI Version upload;
- no remote smoke from Actions.

Do **not** connect Workers Builds (would default toward `wrangler deploy`).

## Architecture decision

- Pipeline may **upload Versions**; it must **never** create/alter Deployments.
- Manual promotion remains CF-005-style (`versions deploy`) outside this workflow.

## Next steps

1. Authorize commit/push of CF-006.
2. Create Dashboard API Token **JUST Public CI — Version Upload** (Workers edit; no DNS/Routes).
3. `gh secret set CLOUDFLARE_API_TOKEN` (value never logged).
4. `gh workflow run cloudflare-preview-version.yml --ref main`
5. Hub CF-006 evidence report.
6. **CF-007** — production Worker (no traffic).

## Do not overwrite

- Homepage / payload Hub contracts.
- Customer DNS / Cloudflare without explicit ops task.
- Unrelated Hub finance scripts.
