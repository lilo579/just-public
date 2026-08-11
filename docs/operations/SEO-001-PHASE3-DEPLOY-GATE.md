# SEO-001 Phase 3–5 — Deploy / enforcement gates

| Campo | Valor |
|-------|-------|
| **ADR** | ADR-SEO-001 |
| **Date** | 2026-08-09 |

```text
DO NOT DEPLOY PHASE 4 before:
1. structure-only migration applied
   (20260809140000_public_host_canonical_authority_v1);
2. linked Supabase types regenerated;
3. compatible Edge deployed;
4. canonical payload validated in staging;
5. Cloudflare one-hop rules prepared (not activated);
6. tenant primary-data migration and redirect activation coordinated;
7. rollback snapshots available.
```

```text
DO NOT ENABLE GO-LIVE GATES IN PRODUCTION before:
1. legacy tenant data migration completed;
2. structure RPCs applied
   (public_host_canonical_authority + tenant_public_domain_readiness);
3. compatible Edge and Public Layer deployed;
4. Cloudflare one-hop active per migrated tenant;
5. external readiness checker passing;
6. rollback snapshot available;
7. pilot approved.
```

## Phase 6 (just-public) — completed locally

See `SEO-001-PHASE6-PERFORMANCE-OBSERVABILITY.md`.

```text
DO NOT PROCEED TO PHASE 7 / PRIMARY FLIP before:
1. no duplicate canonical fetch per request;
2. transient authority failures are noindex/no-store;
3. logs and timings validated in staging;
4. cache purge plan ready before primary flip.
```
