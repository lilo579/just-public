# JUST Product SEO Compiler v1

Função pura em `src/lib/productSeoCompilerV1.js`. Preview estritamente report-only.
Esta nota descreve o que o compilador **calcula**, o que o Public **publica hoje**, e o que o **enforcement futuro** faria. Não aplica migration, Hub, HTML, sitemap, banco, Edge, deploy ou Search Console.

## Três camadas (não misturar)

| Camada | O que é | Onde vive agora |
|---|---|---|
| **Resultado calculado** | Saída determinística de `compileProductSeoV1` / `compileCatalogSeoV1`: `effectiveProductName`, title/meta/og/alt, JSON-LD proposto, `state`, `errors`, `compilerVersion`, `contentFingerprint`. | Somente memória / relatório. Não é HTML. |
| **Resultado publicado** | Title, description, canonical, robots, JSON-LD e sitemap que o Worker **já emite** nas PDPs. | `[slug].astro`, `sitemap.xml.ts`, headers de publicação SEO-001. **Inalterado por este compilador.** |
| **Enforcement futuro** | Usar `state` para `index,follow` vs `noindex,follow`, filtrar sitemap, emitir JSON-LD Product compilado. | **Não implementado.** Exige flag por tenant, carência report-only e GO explícito. |

`robotsProposed` e `inSitemapProposed` no relatório são **propostas**. Não alteram `X-Robots-Tag`, `<meta name="robots">` nem o sitemap.

## Algoritmo e precedência

Normalização de **display**: Unicode NFC, colapsar whitespace, trim. UUID RFC nunca entra como texto público.

Chave de **identidade** (colisão): NFC → NFD, remover marcas diacríticas, minúsculas. Caixa, acento, espaços e Unicode equivalente colidem.

### Quem pode o quê

| Papel | Campos |
|---|---|
| **Identidade** (`effectiveProductName`, H1, `imageAlt`, title automático, `og:title`) | `lineName` → `name` → `variantAttributes[]` → `categoryName` (só se a etapa resolver o grupo inteiro) → `publicProductCode` público não-UUID. Se ainda colidir: `identityLabelOverride` factual por produto. |
| **Descrição** (`metaDescription`, `ogDescription`, JSON-LD `description`) | `description` factual; se não informativa, composição a partir dos tokens de identidade. `seoDescriptionOverride` independente, se válido. |
| **Proibidos como autoridade de identidade** | `description` (mesmo com cor/modelo), fotografia, preço, UUID, slug, posição/ordem, URL/canonical, host, tenant id como branch, inferência. `""` não diferencia. |
| **Overrides opcionais e independentes** | `identityLabelOverride` (só se faltar atributo estruturado). `seoTitleOverride` (só o title SEO). `seoDescriptionOverride` (meta/og/JSON-LD). Ausência de override é o caminho normal. Não exigir title e description juntos. |

### Identidade (`effectiveProductName`)

Tokens em ordem, deduplicados (igual ou contido, mínimo 4 caracteres):

1. `lineName`
2. `name`
3. Se o grupo de **produtos ativos** ainda colide: `variantAttributes[]` estruturados.
4. Se ainda colide: `categoryName` estruturada.
5. Se ainda colide: `publicProductCode` real (não UUID).
6. Se o produto ativo ainda está no grupo ambíguo: `identityLabelOverride` factual, não vazio, não UUID, único no catálogo **ativo**. Compõe H1, title automático, og:title e alt. Não exige meta description. Vizinho sem label permanece `needs_input`.

Cada estágio estruturado **só aplica** se, depois dele, **todos** os ativos do grupo tiverem nomes finais não vazios, únicos na mesma normalização, e cada membro tiver recebido extra factual não vazio. Categoria ou código em só uma linha **não** gera `auto_ready`.

Join: ` · `. Title automático: `{effectiveProductName} | {brand}`.

`description` **nunca** cria token de identidade, não resolve colisão e não promove `needs_input` → `auto_ready`.

### Descrição efetiva

1. `seoDescriptionOverride` válido (independente do title).
2. Description existente se informativa (≥ 2 palavras e não igual só à line ou só ao name).
3. Senão, composição factual dos tokens de identidade. Sem benefícios inventados.

### Overrides

Ausência de override é o fluxo normal. Os três campos são independentes:

| Campo | Quando | Efeito se válido | Se inválido |
|---|---|---|---|
| `identityLabelOverride` | Só se a identidade estruturada não basta | Resolve `needs_input` daquele produto (`override_ready`); entra em H1/title automático/og:title/alt | Identidade automática permanece; produto segue `needs_input` se o grupo continuar ambíguo |
| `seoTitleOverride` | Avançado, opcional | Substitui somente o title SEO (não H1, não og:title, não alt) | Title automático permanece |
| `seoDescriptionOverride` | Avançado, opcional | Substitui meta, og e JSON-LD description | Descrição automática permanece |

Validação de override e de campos factuais (`name`, `lineName`, `brand`, `categoryName`, `publicProductCode`, `variantAttributes`, `description`): **plain text**, rejeita sem sanitizar. NFC para display após passar. Detecção de scheme usa decode de entidades (incluindo `&colon;`) + NFKC (U+FF1A) e nunca é publicada. Limites em **pontos de código**. Rejeita `<` `>`, C0/C1, bidi, ZWSP/BOM, `javascript:` / `vbscript:` / `data:` / `file:` ofuscados, e URL em identity/title. Identidade obrigatória inválida (`name`) → `needs_input`. Atributo opcional inválido → ignorado e registrado. Description inválida → composição factual. `Solar` / `Anelar` são válidos; `Kossot · Marinho & Ouro Claro · Cosset` é restatement. Separadores de restatement: espaço, `·`, hífen estrutural, dois-pontos, `/ | ; ,` e equivalentes Unicode.

Imagens e canonical: validador HTTPS próprio (não plain text). Só `https:` sem credenciais, host não vazio, sem schemes perigosos. Itens inválidos são descartados um a um. **Imagem ausente não bloqueia indexação** na v1: `missing_valid_image` é `qualityWarning`. JSON-LD é emitido sem `image`. Dedup determinístico por `URL.href`. Canonical inválida é bloqueante.

**HTML futuro:** todo valor exige escaping no boundary. Nunca `set:html`, `innerHTML` ou equivalente.

Duplicata de identity label no catálogo ativo: fail-closed. Produto suspenso **não** reserva label contra ativos. Tenant/host não entra na validação de colisão.

Texto de `needs_input` (relatório/UI futuro). **Não** usar “preencher SEO”:

> Precisamos diferenciar estes produtos. Informe o tipo, modelo ou outra característica real.

### Fingerprint

SHA-256 do JSON canônico das **entradas que alteram o resultado**. Sem `computed_at`. `tenantId` é contexto de ownership e **não** entra no hash.

| Incluídas | Excluídas |
|---|---|
| `compilerVersion`, `productId`, `slug`, `canonicalUrl`, `name`, `lineName`, `categoryName`, `description`, `variantAttributes`, `publicProductCode`, `images`, `price`, `currency`, `availability`, `brand`, `visible`, `catalogEnabled`, `tenantActive`, `identityLabelOverride`, `seoTitleOverride`, `seoDescriptionOverride` | `tenantId`, `host`, `computedAt`, `override` (objeto legado) |

A matriz de colisão agrupa pela **mesma chave** de identidade (NFC→NFD, sem marcas, minúsculas). Displays (`Café` vs `Cafe`) são só apresentação.

Métricas de `needs_input` (não tratar possibilidade teórica como resolução conhecida):

| Campo | Significado |
|---|---|
| `needsInputCount` | Quantos produtos estão `needs_input` |
| `hasStructuredResolutionCandidate` | Colisão em que o grupo já tem extra estruturado só em parte das linhas (ação concreta: completar o atributo/código) |
| `requiresIdentityLabelOrNewAttribute` | Colisão sem extra estruturado aplicável; falta fato novo ou `identityLabelOverride` |

### Taxonomia de resultados

| Bucket | O que entra | Efeito no `state` |
|---|---|---|
| `blockingErrors` | Identidade duplicada, `name` obrigatório inválido, canonical/slug inválidos ou duplicados, `not_public` | `needs_input` ou `suspended` |
| `qualityWarnings` | Imagem ausente/inválida, atributo opcional ignorado, description inválida com composição factual | Não muda indexação |
| `overrideErrors` | Override recusado; valor automático permanece | Não bloqueia se o automático for válido |

Indexação orgânica ≠ rich result:

| Campo | Significado |
|---|---|
| `indexingProposed` | `auto_ready` / `override_ready` → index,follow e sitemap |
| `inSitemapProposed` | Igual a `indexingProposed` |
| `jsonLdProposed` | JSON-LD Product proposto quando indexável, mesmo sem image/offers |
| `structuredDataComplete` / `richResultEligible` | Diagnóstico: name+url+description+image+offers. Ausência de image/offers/review **não** gera noindex |

### JSON-LD proposto (só `auto_ready` / `override_ready`)

Product com `url` = canonical própria, `productID` estável = `productId`. Sem `sku` / `gtin` / `mpn` inventados. `offers` só com preço numérico **e** `currency` **e** `availability` factuais. Sem isso, omitir `offers` (BRL de display não conta).

### Estados

| Estado | Indexação proposta | Sitemap proposto | Robots proposto |
|---|---|---|---|
| `auto_ready` | sim | sim | index,follow |
| `override_ready` | sim | sim | index,follow |
| `needs_input` | não | não | noindex,follow |
| `suspended` | não | não | noindex,follow |

`suspended` vem de flags estruturadas (`visible`, `catalogEnabled`, `tenantActive`), não de if por tenant. Produto suspenso **não** entra no agrupamento de colisão dos ativos. Colisão residual: **somente** o grupo ativo com a mesma chave de identidade.

Recompilação: mesma entrada ⇒ saída byte-idêntica. `contentFingerprint` = SHA-256 do JSON canônico das entradas listadas acima. Sem `computed_at` e sem `tenantId`.

Isolamento: o caller passa um catálogo. Não há estado de módulo. Dois tenants com os mesmos nomes de cor/linha não se contaminam se compilados em listas separadas.

## Preview report-only

`previewCatalogSeoReportOnly(inputs)` e `scripts/preview-product-seo-compiler-v1.mjs`.

Não importar o compilador em `[slug].astro`, `sitemap.xml.ts`, `robots.txt.ts` ou Hub.

## Schema SQL

`ops/seo001/product-publication-state.PREPARED.sql` — **PREPARED / não aplicado**.
