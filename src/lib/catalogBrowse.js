/**
 * Reusable catalog browse helpers (F3 / shop tenants).
 */

/**
 * @typedef {{
 *   product_id: string
 *   name: string
 *   slug: string
 *   price: number | null
 *   image_url: string | null
 *   featured: boolean
 *   sort_order: number
 *   company_name: string | null
 *   whatsapp_number: string | null
 *   category_slug: string | null
 *   category_name: string | null
 *   line_slug: string | null
 *   line_name: string | null
 *   collection_slugs: string[] | null
 * }} CatalogProductRow
 */

/**
 * @typedef {{
 *   kind: 'category' | 'line' | 'collection' | string
 *   id: string
 *   name: string
 *   slug: string
 *   sort_order: number
 *   image_url: string | null
 *   product_count: number
 * }} CatalogTaxonomyRow
 */

/**
 * @param {URLSearchParams} searchParams
 */
export function readCatalogFilters(searchParams) {
  return {
    // Preserve UUID case; only trim. Slug match is case-insensitive downstream.
    category: (searchParams.get("category") || "").trim() || null,
    line: (searchParams.get("line") || "").trim() || null,
    collection:
      (searchParams.get("colecao") || searchParams.get("collection") || "").trim() ||
      null,
  };
}

/**
 * Resolve a Golden Master filter value (UUID id or slug) to a taxonomy row.
 * @param {string | null} param
 * @param {CatalogTaxonomyRow[]} taxonomy
 * @param {'category' | 'line' | 'collection'} kind
 * @returns {CatalogTaxonomyRow | null}
 */
export function resolveTaxonomyFilter(param, taxonomy, kind) {
  if (!param) return null;
  const rows = (taxonomy || []).filter((row) => row.kind === kind);
  const exact = rows.find((row) => row.id === param);
  if (exact) return exact;
  const lowered = param.toLowerCase();
  return rows.find((row) => String(row.slug || "").toLowerCase() === lowered) || null;
}

/**
 * @param {CatalogProductRow[]} products
 * @param {{ category: string | null, line: string | null, collection: string | null }} filters
 * @param {CatalogTaxonomyRow[]} [taxonomy]
 */
export function filterCatalogProducts(products, filters, taxonomy = []) {
  const category = resolveTaxonomyFilter(filters.category, taxonomy, "category");
  const line = resolveTaxonomyFilter(filters.line, taxonomy, "line");
  const collection = resolveTaxonomyFilter(
    filters.collection,
    taxonomy,
    "collection",
  );

  // Invalid explicit filters → empty set (do not silently show all).
  if (filters.category && !category) return [];
  if (filters.line && !line) return [];
  if (filters.collection && !collection) return [];

  return products.filter((product) => {
    if (category && product.category_slug !== category.slug) return false;
    if (line && product.line_slug !== line.slug) return false;
    if (collection) {
      const slugs = Array.isArray(product.collection_slugs)
        ? product.collection_slugs
        : [];
      if (!slugs.includes(collection.slug)) return false;
    }
    return true;
  });
}

/**
 * When the tenant was selected via `?host=` (Workers preview / local),
 * preserve that host on catalog and PDP links. Production apex has no
 * `?host=` → returns "" so hrefs stay clean (`/p/slug`).
 *
 * @param {URLSearchParams} searchParams
 * @param {string | null | undefined} resolvedHost
 * @returns {string}
 */
export function resolveCatalogHostOverride(searchParams, resolvedHost) {
  const host = typeof resolvedHost === "string" ? resolvedHost.trim() : "";
  if (!host) return "";
  if (searchParams && searchParams.has("host")) return host;
  return "";
}

/**
 * @param {string | null | undefined} hostOverride
 * @param {string} path
 * @param {Record<string, string | null | undefined>} params
 */
export function buildCatalogHref(hostOverride, path, params = {}) {
  const url = new URL(path, "https://example.invalid");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  if (hostOverride) url.searchParams.set("host", hostOverride);
  return `${url.pathname}${url.search}`;
}

/**
 * @param {Array<{ href?: string, label?: string } | null | undefined> | null | undefined} navItems
 * @param {string | null | undefined} hostOverride
 */
export function applyHostOverrideToNavItems(navItems, hostOverride) {
  if (!hostOverride || !Array.isArray(navItems)) return navItems || [];
  return navItems.map((item) => {
    if (!item || typeof item !== "object") return item;
    const href = typeof item.href === "string" ? item.href.trim() : "";
    if (!href || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
      return item;
    }
    return { ...item, href: buildCatalogHref(hostOverride, href) };
  });
}

/**
 * @param {number | null | undefined} price
 */
export function formatCatalogPrice(price) {
  if (price == null || Number.isNaN(Number(price))) return null;
  return `R$ ${Number(price).toFixed(0)}`;
}
