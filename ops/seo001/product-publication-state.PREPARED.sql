-- JUST Product SEO Compiler v1 — schema PREPARADO, NÃO APLICADO.
-- Status: PREPARED / not applied.
-- Do not run this file. No migration, grant, backfill, or production DDL.
-- Calculated compiler output lives in-process. This table is a future store
-- for derived publication state, not a tenant-editable CMS form.

-- Estado derivado. O tenant não edita esta tabela.
CREATE TABLE IF NOT EXISTS public.product_publication_state (
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  compiler_version text NOT NULL,
  content_fingerprint text NOT NULL,
  effective_product_name text,
  effective_h1 text,
  effective_title text,
  effective_description text,
  effective_og_title text,
  effective_og_description text,
  effective_image_alt text,
  state text NOT NULL CHECK (
    state IN ('auto_ready', 'override_ready', 'needs_input', 'suspended')
  ),
  blocking_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  override_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_fields text[] NOT NULL DEFAULT '{}',
  indexing_enabled boolean NOT NULL,
  computed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, product_id)
);

-- Overrides v1: três campos independentes. Ausência é o fluxo normal.
-- Inválido => rejeitar aquele campo; o valor automático permanece.
-- Não usar o contrato legado title + description.
CREATE TABLE IF NOT EXISTS public.product_seo_overrides (
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  identity_label_override text,
  seo_title_override text,
  seo_description_override text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (tenant_id, product_id)
);

-- Campos de produto ainda NÃO presentes e NÃO criados aqui:
-- public_product_code, availability, price_currency, structured variants.
-- O compilador v1 opera sem eles; só os usa se existirem no input factual.
