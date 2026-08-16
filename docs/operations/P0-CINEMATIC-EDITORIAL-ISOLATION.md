# P0 Public — contrato cinematic editorial v1

Ver o canônico em Nexus `docs/operations/P0-CINEMATIC-EDITORIAL-ISOLATION.md`.

Public compatível:

- Marcador ausente → fallback legado temporário (`plan.chrome.cinematicEditorial`).
- `v1` → Hub payload autoritativo; blob do plano ignorado.
- Versão desconhecida → fail-closed.

GATE: nunca promover Edge v1 enquanto o Public ativo for o bundle antigo
(o plano deixa de trazer o blob de fábrica; o Public antigo ignora `meta.cinematicEditorial`).

JUST / Coming Soon / Site Mode intocados. Push/PR/produção: **NO-GO**.
