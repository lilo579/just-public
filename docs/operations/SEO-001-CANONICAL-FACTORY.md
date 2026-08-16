# SEO-001 Public factory notes

`SEO001_ENFORCE_PUBLICATION_INDEXING` unset: robots/sitemap bodies and `max-age=300` unchanged for the seven.

Flag ON: unknown/missing/invalid publication → noindex, `Cache-Control: no-store`. Canonical never invented. Publication is host-bound on the payload, never a tenant UUID RPC from the Worker.
