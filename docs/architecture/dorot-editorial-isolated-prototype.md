# `dorot-editorial` reference — isolated prototype

| Field | Value |
|-------|--------|
| Status | **ISOLATED PROTOTYPE — NOT WIRED INTO F4** |
| Date | 2026-09-10 |
| Scope | Documentation note only |

## Finding

On this `just-public` checkout (`feat/site-engine-f4-mission-family`), there is **no** active `dorot-editorial` production path, CSS pack, freeze helper, or host branch under `src/`.

Historical Dorot-specific Public Layer experiments (hero reference / editorial freeze) are **not** part of the F4 Mission Family foundation. F4 uses:

- synthetic tenant `www.canonical-f4.example.test` (`src/poc/syntheticF4MissionTenant.js`)
- generic paint components (`Mission*Block.astro`)
- shared reader `src/lib/editorialPublicationsReader.js` with log prefix `[just.publications]`

## Rule

Do **not** wire Dorot identity, assets, or `dorot-editorial` modules into F4 compiler, painter, renderer, or domain reader selection.
