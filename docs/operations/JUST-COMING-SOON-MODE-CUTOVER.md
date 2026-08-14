# JUST Coming Soon mode — deploy / cutover sequence

Status: **documentation only**. Do not execute this sequence from this change set.
No Edge deploy, no Public deploy, no Hub `site.mode` write, no DNS/Cloudflare, no push/PR.

## Why this order exists

Live Hub `site_content` for tenant `just` already stores `site.mode=COMING_SOON`.
Live Public HTML is still institutional because Edge `public-site-payload` does **not**
publish `source.meta.siteMode`, and Public treats missing mode as `NORMAL`.

**Do not deploy the Edge bundle that emits `meta.siteMode` while the database is `COMING_SOON`.**
That would make Public resolve `COMING_SOON` immediately and replace the institutional homepage
without a guarded cutover.

The Public form fix must ship first so that, if Coming Soon ever paints, it does not show a
lead form that fakes success (`leadCaptureEnabled=false` + packaged `leadForm` copy).

## Sequence (future, guarded)

1. **Deploy Public** (this renderer fix: hide lead form unless `leadCaptureEnabled === true`).
2. **Confirm institutional still live** on apex/www. Payload still lacks `siteMode` → `NORMAL`.
3. **Snapshot** current `site.mode` / `site.mode.config`. Guarded write **`COMING_SOON` → `NORMAL`**
   in Hub. Required because the database today is already `COMING_SOON`.
4. **Deploy Edge** that publishes the canonical `meta.siteMode` / `meta.siteModeConfig` contract.
5. **Confirm** payload `siteMode=NORMAL` and HTML remains institutional (`JustInstitutionalHomepage`).
6. Guarded write **`NORMAL` → `COMING_SOON`** (same snapshot/rollback window).
7. **Confirm** payload `COMING_SOON` and HTML Coming Soon **without** the lead form
   (`leadCaptureEnabled=false`).
8. Run SEO/redirect checker (canonical apex, OG, JSON-LD, preview/staging noindex, legales).
9. **Rollback** to `NORMAL` if anything fails (Hub `site.mode` only; Public form-honest code can stay).

## GO / NO-GO for this local work

- **Push / PR: NO-GO** until explicitly authorized.
- **Edge deploy: NO-GO** while DB is `COMING_SOON`.
- **Live `site.mode` change: NO-GO** from this work.
- **Lead capture backend: NO-GO**.
