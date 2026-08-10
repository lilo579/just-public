# SEO-001 Phase 4 — Cloudflare one-hop HTTPS + host rule (plan only)

| Campo | Valor |
|-------|-------|
| **ADR** | ADR-SEO-001 |
| **Date** | 2026-08-09 |
| **Status** | Prepared — **DO NOT ACTIVATE** before Phase 7 / coordinated cutover |

## Why Cloudflare (not the Worker) owns HTTP→HTTPS

The Public Worker typically sees requests **after** TLS termination. Inferring the original `http://` request from forwarded headers is unreliable and unsafe. Therefore:

- **Worker (this repo):** `https://alias` → `301 https://{primary}` (path + allowed query), following RPC/payload `canonical`.
- **Cloudflare zone rule:** `http://*` → `301 https://{primary}/…` in **one hop**, including when the visitor used `http://www`.

Do not activate apex-forcing CF rules while production primaries are still `www.*`. Target host must come from the approved inventory primary, not from string surgery.

## Target construction

For each customer zone, set:

```text
primary_host = inventory.is_primary host for that tenant
# Examples today (Phase 0 inventory — still often www):
#   www.marceloborer.com.br
# After Phase 7 cutover (apex):
#   marceloborer.com.br
```

Dynamic redirect target:

```text
https://{primary_host}${uri}
```

Where `${uri}` is Cloudflare’s path + query (preserve tracking params; CF does not need to strip `host`/`debug` — Worker still cleans on HTTPS alias hits).

## Suggested expression (per zone)

Replace `PRIMARY_HOST` with the inventory primary (no hard-coded apex assumption):

**If** (enable when primary is apex — Phase 7+):

```text
(http.host eq "www.example.com.br" and ssl) or
(not ssl and (http.host eq "example.com.br" or http.host eq "www.example.com.br"))
```

**Then** — Dynamic redirect:

```text
https://example.com.br${uri}
```

Status: `301`  
Preserve query string: yes  

When primary is still `www` (pre–Phase 7), invert the HTTPS host clause so apex HTTPS redirects to `www`, and HTTP (both hosts) redirects to `https://www…${uri}`. **Do not ship a single global “always apex” rule before data cutover.**

## Priority vs “Always Use HTTPS”

1. Place the **combined host+scheme** rule **above** / instead of a naive “Always Use HTTPS” that would create:

   `http://www` → `https://www` → (later) `https://apex` (two hops).

2. The combined rule must land on **final primary HTTPS** in one response.
3. Disable or lower any legacy Page Rule that redirects www↔apex separately from HTTP.

## Loop prevention

- Destination host must equal `PRIMARY_HOST` only.
- Do not chain Page Rules that re-match the destination.
- After activation, `curl -sI` must show a **single** `301` from each non-canonical variant.

## Validation (`curl`)

```bash
# Expect one 301 to https://PRIMARY/path?utm_source=x
curl -sI "http://www.example.com.br/path?utm_source=x"
curl -sI "http://example.com.br/path?utm_source=x"
curl -sI "https://www.example.com.br/path?utm_source=x"   # when primary is apex
curl -sI "https://example.com.br/path"                    # when primary is apex: 200
```

Confirm:

- `HTTP/2 301` (or 301) once
- `location:` exactly `https://PRIMARY/...`
- No second redirect hop

## Rollback

1. Disable the Dynamic Redirect rule (CF dashboard / Terraform).
2. Re-enable prior “Always Use HTTPS” if required for TLS-only.
3. Worker alias redirects remain independently rollbackable via Worker version pin.

## Inventory source

Use the approved Phase 0 inventory / live `tenant_domains` query (`is_primary = true`) — never a repo hardcode map. After Phase 7 migration, regenerate and update CF targets to apex.

## Activation gate

```text
DO NOT activate Cloudflare one-hop rules before:
- Worker Phase 4 redirects deployed and verified on HTTPS aliases;
- Phase 7 primary data migration plan approved;
- per-zone PRIMARY_HOST confirmed;
- rollback owner assigned.
```
