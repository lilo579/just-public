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
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_fields text[] NOT NULL DEFAULT '{}',
  indexing_enabled boolean NOT NULL,
  computed_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, product_id)
);

-- Override avançado opcional. Inválido => rejeitar; estado automático permanece.
CREATE TABLE IF NOT EXISTS public.product_seo_overrides (
  tenant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  title text,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (tenant_id, product_id)
);

-- Campos de produto ainda NÃO presentes e NÃO criados aqui:
-- public_product_code, availability, price_currency, structured variants.
-- O compilador v1 opera sem eles; só os usa se existirem no input factual.
