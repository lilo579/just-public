# P0 Public — contrato cinematic editorial v1

Canônico: Nexus `docs/operations/P0-CINEMATIC-EDITORIAL-ISOLATION.md`.

Public compatível:

- Marcador ausente → fallback legado temporário: devolver o objeto `plan.chrome` **como está** (igual `origin/main`, inclusive planos parciais). Sem spread de flags do authority.
- `v1` + objeto → somente editorial do payload Hub.
- `v1` + `null` → nenhum editorial legado.
- Versão desconhecida → fail-closed.

## Ordens (não misturar)

**Integração Git** (não muda tráfego):

1. Merge Nexus #33 em `main` **sem** deploy da Edge Function.
2. Merge Public #19 (o authority em `main` exporta o contrato v1).

**Tráfego**:

1. Public compatível a **100%** e HTML legado confirmado.
2. Snapshot Hub Celina + seed (autorização própria).
3. Edge v1 candidato / canário.
4. Edge v1 a 100% só depois dos gates.

Merge do Nexus **não** autoriza deploy da Edge Function. GATE: nunca promover Edge v1 enquanto o Public ativo for o bundle antigo.

Nexus #29, Site Mode, Coming Soon e JUST permanecem **fora de escopo**.

Draft PRs #19 / #33: **não marcar ready** nesta correção. Produção / seed / deploy Edge: **NO-GO**.
