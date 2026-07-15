# SYNC_STATUS — just-public

Updated: 2026-07-15 (CF-008 COMPLETE — local commit pending push)

## Source of truth

- Local commit after this update: dual-target `wrangler.jsonc` + CF-008 tests/docs.
- Parent published: **bae975d**.
- Hub: CF-007 COMPLETE (`just-auth-nexus` @ `dc12870`); Hub CF-008 evidence report still pending separate authorization.

## CF-008 — COMPLETE

### Production Worker (`just-public-production`)

| Field | Value |
|-------|--------|
| Status | **COMPLETE** |
| Active Deployment | `cecb8f6c-444b-4699-9933-377844cad4b6` |
| Active Version | Astro `761650a3-05f4-494f-9be7-e79ecf168af5` @ **100%** |
| Bootstrap Version (retained) | `65297578-6813-42fd-a227-349f72ba70c1` |
| `DEPLOY_ENV` | `staging` |
| `POC_FIXTURE_MODE` | `false` (fixtures disabled) |
| LeadForm | safe (staging) |
| `workers_dev` | false (hostname 1042) |
| `previews_enabled` | true |
| Hostname | `public-staging.justwebsites.com.br` |
| Routing | **Custom Domain** (not Worker Route) |
| DNS / TLS | managed by Cloudflare |
| Worker Routes | **0** |
| Real `/health` | **200** · `noindex, nofollow` |
| Real `/` | **503** controlled (`PUBLIC_SITE_PAYLOAD_URL missing`) |
| Existing hosts (apex/www/hub/customers) | **intact** |
| Issue urllib/403 | accepted, non-blocking |

### POC Worker (`just-public-poc`) — unchanged

| Field | Value |
|-------|--------|
| Active Deployment | `a0368c3e-…` → Bootstrap `3047d28b-…` @ **100%** |
| CF-006 workflow | still targets POC only |

## Next steps

1. Hub CF-008 evidence report (when authorized).
2. **CF-009** Production Readiness Review (no commercial rollout).

## Do not overwrite

- Hub contracts · customer DNS · Lovable sites · Hub finance scripts.
